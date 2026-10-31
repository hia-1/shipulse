import { http } from './index'

export type FeedKind = 'all' | 'checkin' | 'text' | 'review' | 'booklist'
export type FeedSort = 'hot' | 'latest'

export interface FeedAuthor {
  id: number
  nickname: string
  avatarUrl: string
  isMember: boolean
}

export interface FeedItem {
  kind: 'checkin' | 'text' | 'review' | 'booklist'
  id: number
  author: FeedAuthor
  publishedAt: string | null
  title?: string
  content?: string
  rating?: number
  readMinutes?: number
  images?: string[]
  location?: string
  book?: { id: number; title: string; coverUrl: string } | null
  itemCount?: number
  isOfficial?: boolean
  collectCount?: number
  topicId?: number | null
  likeCount: number
  commentCount: number
  isLiked: boolean
}

export interface FeedResult {
  list: FeedItem[]
  total: number
  hotTotal: number
  page: number
  pageSize: number
  tabs: { value: FeedKind; label: string }[]
  topicId?: number | null
  hasMore: boolean
}

export interface FeedTopic {
  id: number
  title: string
  description: string
  coverUrl: string
  postCount: number
}

/** 动态流聚合（打卡/图文/书评/书单） */
export function fetchFeed(params: {
  type?: FeedKind
  sort?: FeedSort
  page?: number
  pageSize?: number
  topicId?: number
}) {
  return http.get<FeedResult>('/feed', { params })
}

/** 活跃话题列表（动态流筛选 chips） */
export function fetchFeedTopics() {
  return http.get<FeedTopic[]>('/feed/topics')
}

/** 今日打卡状态与阅读时长 */
export function fetchTodayStatus() {
  return http.get<{
    checkedToday: boolean
    todayMinutes: number
    checked: { id: number; readMinutes: number } | null
  }>('/posts/today')
}

/** 阅读打卡 */
export function createCheckin(data: {
  bookId: number
  content?: string
  readMinutes?: number
  topicId?: number
}) {
  return http.post<FeedItem & { audit: { status: string; reason: string } }>(
    '/posts/checkin',
    data,
  )
}

/** 发布图文动态 */
export function createTextPost(data: {
  content: string
  images?: string[]
  location?: string
  topicId?: number
}) {
  return http.post<FeedItem & { audit: { status: string; reason: string } }>('/posts', data)
}

/** 我的动态 */
export function fetchMyPosts(page = 1, pageSize = 10) {
  return http.get<{ list: (FeedItem & { audit: { status: string; reason: string } })[]; total: number; page: number; pageSize: number }>(
    '/posts/my',
    { params: { page, pageSize } },
  )
}

/** 点赞/取消点赞动态 */
export function togglePostLike(id: number) {
  return http.post<{ isLiked: boolean; likeCount: number; id: number }>(`/posts/${id}/like`)
}

/** 删除自己的动态 */
export function deletePost(id: number) {
  return http.delete<{ deleted: boolean; id: number }>(`/posts/${id}`)
}