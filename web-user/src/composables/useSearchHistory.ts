const KEY = 'shipulse_search_history'
const MAX = 10

/** 读取搜索历史（本地存储） */
export function getHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** 记录一条历史（去重置顶，保留最近 MAX 条） */
export function addHistory(keyword: string): string[] {
  const list = getHistory().filter((x) => x !== keyword)
  list.unshift(keyword)
  if (list.length > MAX) list.length = MAX
  localStorage.setItem(KEY, JSON.stringify(list))
  return list
}

/** 清空历史 */
export function clearHistory() {
  localStorage.removeItem(KEY)
}