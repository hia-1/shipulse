import { http } from './index'
import type { BookItem } from './library'

export interface SuggestResult {
  books: BookItem[]
  isbnHit: BookItem | null
}

export interface HotItem {
  keyword: string
  count: number
}

/** 搜索联想 + ISBN 精确命中 */
export function fetchSuggest(keyword: string, limit = 8) {
  return http.get<SuggestResult>('/search/suggest', { params: { keyword, limit } })
}

/** 热搜词 */
export function fetchHot(limit = 10) {
  return http.get<HotItem[]>('/search/hot', { params: { limit } })
}

/** 记录一次搜索（热词自增，fire-and-forget） */
export function recordSearch(keyword: string) {
  return http.post<{ ok: boolean }>('/search/record', { keyword })
}