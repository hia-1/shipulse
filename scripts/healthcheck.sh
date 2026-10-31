#!/usr/bin/env sh
# ============================================================================
# 服务健康检查 + 故障告警（P2-16 · 16-2）
#
# 用途：探测后端 /health、MySQL、Redis 可用性；异常时调用 alert.sh 告警。
# 建议 crontab（每 2 分钟探测一次）：
#   */2 * * * * /opt/shipulse/scripts/healthcheck.sh >> /var/log/shipulse-health.log 2>&1
#
# 环境变量：
#   HEALTH_URL       后端健康检查地址（默认 http://127.0.0.1:3000/health）
#   DB_CONTAINER     MySQL 容器名（默认 shipulse-mysql）
#   REDIS_CONTAINER  Redis 容器名（默认 shipulse-redis）
# ============================================================================
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ALERT_SCRIPT="$SCRIPT_DIR/alert.sh"

HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000/health}
DB_CONTAINER=${DB_CONTAINER:-shipulse-mysql}
REDIS_CONTAINER=${REDIS_CONTAINER:-shipulse-redis}

PROBLEMS=""
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 1) 后端健康检查
if command -v curl >/dev/null 2>&1; then
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" || echo 000)
  if [ "$CODE" != "200" ]; then
    PROBLEMS="${PROBLEMS}
- 后端健康检查异常：${HEALTH_URL} 返回 ${CODE}"
  fi
else
  log "未找到 curl，跳过后端探测"
fi

# 2) MySQL 存活
if command -v docker >/dev/null 2>&1; then
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
    PROBLEMS="${PROBLEMS}
- MySQL 容器未运行：${DB_CONTAINER}"
  fi
  # 3) Redis 存活
  if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${REDIS_CONTAINER}$"; then
    PROBLEMS="${PROBLEMS}
- Redis 容器未运行：${REDIS_CONTAINER}"
  fi
fi

# 4) 磁盘水位（根分区使用率 >= 90% 告警）
USAGE=$(df -P / 2>/dev/null | awk 'NR==2 {gsub("%","",$5); print $5}')
if [ -n "${USAGE:-}" ] && [ "$USAGE" -ge 90 ] 2>/dev/null; then
  PROBLEMS="${PROBLEMS}
- 磁盘使用率过高：根分区 ${USAGE}%"
fi

if [ -n "$PROBLEMS" ]; then
  log "检测到异常：$PROBLEMS"
  [ -x "$ALERT_SCRIPT" ] && "$ALERT_SCRIPT" "健康检查发现异常：${PROBLEMS}" || true
  exit 1
fi

log "健康检查通过"
exit 0
