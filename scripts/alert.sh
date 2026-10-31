#!/usr/bin/env sh
# ============================================================================
# 故障告警接入点（P2-16 · 16-2）
#
# 用途：备份失败、健康检查失败、磁盘水位告警等场景统一调用本脚本发送通知。
# 支持渠道（按需配置，可同时启用）：
#   1) 企业微信群机器人 webhook  —— 环境变量 ALERT_WEBHOOK
#   2) 邮件（需系统已装 mail / sendmail）—— ALERT_EMAIL + ALERT_MAIL_CMD
#
# 用法：
#   ./scripts/alert.sh "告警正文"
#   echo "多行内容" | ./scripts/alert.sh
#
# 说明：任一渠道失败不影响退出码（告警本身不应阻断主流程），仅打印到 stderr。
# ============================================================================
set -eu

MSG=${1:-}
if [ -z "$MSG" ]; then
  MSG=$(cat)
fi

HOSTNAME_SH=$(hostname 2>/dev/null || echo unknown)
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FULL_MSG="【时脉书社·告警】${TIMESTAMP} @ ${HOSTNAME_SH}
${MSG}"

# ---- 渠道 1：企业微信 webhook ----
if [ -n "${ALERT_WEBHOOK:-}" ]; then
  # 转义为 JSON 字符串：先转义反斜杠与双引号，再把换行替换为 \n
  ESCAPED=$(printf '%s' "$FULL_MSG" \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' \
    | sed -e ':a' -e 'N' -e '$!ba' -e 's/\n/\\n/g')
  JSON=$(printf '{"msgtype":"text","text":{"content":"%s"}}' "$ESCAPED")
  if command -v curl >/dev/null 2>&1; then
    curl -sS -X POST -H 'Content-Type: application/json' -d "$JSON" "$ALERT_WEBHOOK" >/dev/null \
      || echo "[alert] 企业微信 webhook 发送失败" >&2
  else
    echo "[alert] 未找到 curl，跳过企业微信告警" >&2
  fi
fi

# ---- 渠道 2：邮件 ----
if [ -n "${ALERT_EMAIL:-}" ]; then
  MAIL_CMD=${ALERT_MAIL_CMD:-mail}
  if command -v "$MAIL_CMD" >/dev/null 2>&1; then
    printf '%s' "$FULL_MSG" | "$MAIL_CMD" -s "【时脉书社·告警】${TIMESTAMP}" "$ALERT_EMAIL" \
      || echo "[alert] 邮件发送失败" >&2
  else
    echo "[alert] 未找到邮件命令 ${MAIL_CMD}，跳过邮件告警" >&2
  fi
fi

# 未配置任何渠道时，退化为标准错误输出，保证告警内容不丢失
if [ -z "${ALERT_WEBHOOK:-}" ] && [ -z "${ALERT_EMAIL:-}" ]; then
  echo "$FULL_MSG" >&2
fi

exit 0
