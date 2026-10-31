import { http } from './index'

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'system'
  | 'order'
  | 'audit'

export type NotificationCategory = 'like' | 'comment' | 'system'

export interface NotificationSender {
  id: number
  nickname: string
  avatarUrl: string
}

export interface NotificationItem {
  id: number
  type: NotificationType
  category: NotificationCategory
  title: string
  content: string
  senderId: string
  sender: NotificationSender | null
  targetType: string
  targetId: string
  isRead: boolean
  readAt: string | null
  createdAt: string
}

export interface NotificationListResult {
  list: NotificationItem[]
  total: number
  page: number
  pageSize: number
}

export interface UnreadCount {
  total: number
  like: number
  comment: number
  system: number
}

/** 消息列表（分类 Tab：all/like/comment/system） */
export function listNotifications(params: {
  type?: NotificationCategory | 'all'
  page?: number
  pageSize?: number
} = {}) {
  return http.get<NotificationListResult>('/notifications', { params })
}

/** 未读数（总数 + 各分类） */
export function getUnreadCount() {
  return http.get<UnreadCount>('/notifications/unread-count')
}

/** 单条标记已读 */
export function markNotificationRead(id: number) {
  return http.patch<{ id: number; isRead: boolean }>(`/notifications/${id}/read`)
}

/** 全部标记已读（可按分类） */
export function markAllNotificationsRead(type?: NotificationCategory | 'all') {
  return http.patch<{ updated: number }>('/notifications/read-all', null, {
    params: type && type !== 'all' ? { type } : undefined,
  })
}