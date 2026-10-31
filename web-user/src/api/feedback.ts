import { http } from './index'

export const FEEDBACK_TYPES = ['suggestion', 'bug', 'other'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: '功能建议',
  bug: '问题反馈',
  other: '其他',
}

export type FeedbackStatus = 'pending' | 'processing' | 'replied' | 'closed'

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  replied: '已回复',
  closed: '已关闭',
}

export interface FeedbackItem {
  id: number
  type: FeedbackType
  content: string
  contact: string
  status: FeedbackStatus
  reply: string
  repliedAt: string | null
  createdAt: string
}

export interface FeedbackListResult {
  list: FeedbackItem[]
  total: number
  page: number
  size: number
}

/** 提交意见反馈（登录用户） */
export function submitFeedback(data: {
  type?: FeedbackType
  content: string
  contact?: string
  images?: string[]
}) {
  return http.post<{ id: number; status: FeedbackStatus; createdAt: string }>(
    '/feedback',
    data,
  )
}

/** 我的反馈记录 */
export function listMyFeedback(page = 1, size = 10) {
  return http.get<FeedbackListResult>('/feedback/mine', { params: { page, size } })
}
