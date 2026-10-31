import { http } from './index'

export interface ReviewAuthor {
  id: number
  nickname: string
  avatarUrl: string
  isMember: boolean
}

export interface ReviewItem {
  id: number
  bookId: number
  bookTitle: string
  coverUrl: string
  rating: number
  title: string
  content: string
  likeCount: number
  commentCount: number
  auditStatus: string
  auditReason: string
  isFeatured: boolean
  publishedAt: string | null
  createdAt: string
  author: ReviewAuthor
  isLiked?: boolean
  audit?: { status: string; reason: string }
}

export interface ReviewListResult {
  list: ReviewItem[]
  total: number
  page: number
  pageSize: number
}

export interface ReviewComment {
  id: number
  parentId: number
  replyToUid: number
  replyToNickname?: string
  content: string
  likeCount: number
  createdAt: string
  author: { id: number; nickname: string; avatarUrl: string }
}

/** 发布书评 */
export function createReview(data: { bookId: number; rating: number; title: string; content?: string }) {
  return http.post<ReviewItem & { audit: { status: string; reason: string } }>(
    '/community/reviews',
    data,
  )
}

/** 书评列表（仅已通过审核） */
export function listReviews(params: {
  bookId?: number
  userId?: number
  keyword?: string
  sort?: 'default' | 'hot' | 'rating'
  page?: number
  pageSize?: number
} = {}) {
  return http.get<ReviewListResult>('/community/reviews', {
    params: {
      ...(params.bookId ? { bookId: params.bookId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.keyword ? { keyword: params.keyword } : {}),
      ...(params.sort ? { sort: params.sort } : {}),
      ...(params.page ? { page: params.page } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
}

/** 书评详情 */
export function getReviewDetail(id: number) {
  return http.get<ReviewItem>(`/community/reviews/${id}`)
}

/** 我某本书的书评（任意审核状态，未发评返回 null） */
export function getMyReview(bookId: number) {
  return http.get<ReviewItem | null>('/community/reviews/mine', {
    params: { bookId },
  })
}

/** 我的书评列表（任意审核状态） */
export function listMyReviews(page = 1, pageSize = 10) {
  return http.get<ReviewListResult>('/community/reviews/my', {
    params: { page, pageSize },
  })
}

/** 点赞/取消点赞书评 */
export function toggleReviewLike(id: number) {
  return http.post<{ isLiked: boolean; likeCount: number }>(
    `/community/reviews/${id}/like`,
  )
}

/** 删除自己的书评 */
export function deleteReview(id: number) {
  return http.delete<{ deleted: boolean; id: number }>(`/community/reviews/${id}`)
}

/** 发布书评评论 */
export function createComment(id: number, data: { content: string; parentId?: number }) {
  return http.post<ReviewComment & { audit?: { status: string; reason: string } }>(
    `/community/reviews/${id}/comments`,
    data,
  )
}

/** 书评评论列表 */
export function listComments(id: number) {
  return http.get<ReviewComment[]>(`/community/reviews/${id}/comments`)
}