#!/usr/bin/env sh
# ============================================================================
# 时脉书社 · 数据库每日备份 + 7 天轮转（P2-16 · 16-2）
#
# 用法：
#   ./scripts/backup-db.sh                 # 使用环境变量 / .env.prod
#   BACKUP_DIR=/data/backups ./scripts/backup-db.sh
#
# 依赖：mysqldump（本地）或 docker（容器内 mysqldump）、gzip、find
#
# 建议 crontab（每日 03:30 执行，日志留存）：
#   30 3 * * * /opt/shipulse/scripts/backup-db.sh >> /var/log/shipulse-backup.log 2>&1
# ============================================================================
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

# 载入生产环境变量（若存在），用于取数据库连接信息
if [ -f "$PROJECT_DIR/.env.prod" ]; then
  # shellcheck disable=SC1091
  set -a; . "$PROJECT_DIR/.env.prod"; set +a
fi

DB_HOST=${DB_HOST:-127.0.0.1}
DB_PORT=${DB_PORT:-3306}
DB_USER=${DB_USER:-shipulse}
DB_PASSWORD=${DB_PASSWORD:-change_me}
DB_NAME=${DB_NAME:-shipulse}
DB_CONTAINER=${DB_CONTAINER:-shipulse-mysql}

BACKUP_DIR=${BACKUP_DIR:-/var/backups/shipulse}
RETENTION_DAYS=${RETENTION_DAYS:-7}
ALERT_SCRIPT="$SCRIPT_DIR/alert.sh"

mkdir -p "$BACKUP_DIR"

STAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"
TMP_FILE="$OUT_FILE.tmp"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

fail() {
  log "ERROR: $*"
  [ -x "$ALERT_SCRIPT" ] && "$ALERT_SCRIPT" "【时脉书社】数据库备份失败：$*" || true
  rm -f "$TMP_FILE"
  exit 1
}

# 优先走容器内 mysqldump（与生产同源），容器不可用则回退本地客户端
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
  log "使用容器 ${DB_CONTAINER} 执行 mysqldump"
  docker exec "$DB_CONTAINER" sh -c \
    "exec mysqldump --single-transaction --quick --routines --triggers \
      -u'${DB_USER}' -p'${DB_PASSWORD}' '${DB_NAME}'" \
    | gzip -9 > "$TMP_FILE" || fail "mysqldump（容器）执行失败"
else
  command -v mysqldump >/dev/null 2>&1 || fail "未找到 mysqldump，且容器 ${DB_CONTAINER} 不可用"
  log "使用本地 mysqldump 连接 ${DB_HOST}:${DB_PORT}"
  MYSQL_PWD="$DB_PASSWORD" mysqldump \
    -h"$DB_HOST" -P"$DB_PORT" -u"$DB_USER" \
    --single-transaction --quick --routines --triggers \
    "$DB_NAME" | gzip -9 > "$TMP_FILE" || fail "mysqldump（本地）执行失败"
fi

# 校验产物非空，避免把空文件当成有效备份
[ -s "$TMP_FILE" ] || fail "备份文件为空，疑似导出异常"
mv "$TMP_FILE" "$OUT_FILE"
log "备份完成：$OUT_FILE（$(du -h "$OUT_FILE" | cut -f1)）"

# 7 天轮转：删除超过保留期的备份
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
log "轮转清理：删除 ${DELETED} 个超过 ${RETENTION_DAYS} 天的备份"

# 可选：异地副本（对象存储多副本要求）。配置 OSS 同步命令后启用。
# 例：ossutil cp "$OUT_FILE" oss://shipulse-backup/db/ || fail "对象存储上传失败"
if [ -n "${OSS_SYNC_CMD:-}" ]; then
  log "执行异地同步：$OSS_SYNC_CMD"
  sh -c "$OSS_SYNC_CMD" || fail "异地同步失败"
fi

log "全部完成"
