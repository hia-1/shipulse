import { http } from './index'
import type { BookItem } from './library'

export interface HomeBanner {
  id: number
  title: string
  imageUrl: string
  linkType: 'none' | 'book' | 'booklist' | 'web'
  linkValue: string
}

export interface WeeklyBook {
  id: number
  title: string
  subtitle: string
  coverUrl: string
  book: BookItem | null
}

export type RankKey = 'hot' | 'new' | 'rating'

export interface HotReview {
  id: number
  bookId: number
  bookTitle: string
  coverUrl: string
  rating: number
  title: string
  contentPreview: string
  likeCount: number
  commentCount: number
  isFeatured: boolean
  publishedAt: string | null
  author: { nickname: string; isMember: boolean }
}

export interface DiscoverPayload {
  banners: HomeBanner[]
  weeklyBooks: WeeklyBook[]
  rankEntries: Array<{ key: RankKey; name: string; books: BookItem[] }>
  hotReviews: HotReview[]
}

/** 首页（发现式）聚合 */
export function getDiscover() {
  return http.get<DiscoverPayload>('/home/discover')
}

/** 榜单书籍 */
export function getRank(type: RankKey, limit = 10) {
  return http.get<{ type: RankKey; list: BookItem[] }>('/home/rank', {
    params: { type, limit },
  })
}