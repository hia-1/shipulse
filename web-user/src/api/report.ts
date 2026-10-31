import { http } from './index'

export const REPORT_TARGETS = ['review', 'post', 'comment', 'booklist', 'user'] as const
export type ReportTarget = (typeof REPORT_TARGETS)[number]

export const REPORT_REASONS = ['porn', 'abuse', 'ad', 'spam', 'infringe', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  review: '书评',
  post: '动态',
  comment: '评论',
  booklist: '书单',
  user: '用户',
}

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  porn: '色情低俗',
  abuse: '人身攻击',
  ad: '广告营销',
  spam: '垃圾信息',
  infringe: '侵权抄袭',
  other: '其他',
}

export interface ReportResult {
  id: number
  status: string
}

export type AppealStatus = 'pending' | 'approved' | 'rejected'

export interface AppealItem {
  id: number
  userId: string
  targetType: ReportTarget
  targetId: string
  moderationLogId: string | null
  reason: string
  status: AppealStatus
  reviewerId: string | null
  reviewResult: string
  reviewedAt: string | null
  createdAt: string
}

export interface AppealListResult {
  items: AppealItem[]
  total: number
  page: number
  size: number
}

/** 提交举报（对书评/动态/评论/书单/用户） */
export function submitReport(data: {
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  description?: string
  images?: string[]
}) {
  return http.post<ReportResult>('/community/reports', data)
}

/** 提交申诉（对被处罚内容） */
export function submitAppeal(data: {
  targetType: ReportTarget
  targetId: string
  reason: string
}) {
  return http.post<ReportResult>('/community/appeals', data)
}

/** 我的申诉列表 */
export function listMyAppeals(page = 1, pageSize = 10) {
  return http.get<AppealListResult>('/community/appeals/mine', {
    params: { page, pageSize },
  })
}
