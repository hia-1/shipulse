/** 分钟数格式化为「x 分钟 / x 小时 y 分钟」 */
function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} 小时 ${r} 分钟` : `${h} 小时`
}

/** 秒数格式化为「x 分钟」展示（阅读时长以分钟呈现） */
function formatSeconds(seconds) {
  return formatMinutes((Number(seconds) || 0) / 60)
}

/** 评分保留一位小数，无评分显示「暂无」 */
function formatRating(value) {
  const n = Number(value)
  if (!n) return '暂无'
  return n.toFixed(1)
}

/** ISO 时间 → 相对时间展示 */
function relativeTime(iso) {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  const d = new Date(iso)
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`
}

module.exports = { formatMinutes, formatSeconds, formatRating, relativeTime }
