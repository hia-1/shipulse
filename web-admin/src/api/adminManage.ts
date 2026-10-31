import { http } from './index'

export interface PageResult<T> {
  items: T[]
  total: number
  page: number
  size: number
}

export interface PageQuery {
  page?: number
  size?: number
  keyword?: string
  status?: string
  type?: string
}

/** ---------- 数据看板 ---------- */
export interface DashboardStats {
  users: { total: number; today: number; active7d: number }
  books: { total: number; published: number }
  reviews: { total: number; pending: number }
  moderation: { reviewsPending: number; postsPending: number; booklistsPending: number }
  finance: {
    ordersTotal: number
    ordersPaid: number
    pendingCount: number
    revenueFen: number
    revenueTodayFen: number
  }
  members: { active: number }
}

export type TrendPoint = {
  date: string
  users: number
  orders: number
  revenueFen: number
  reviews: number
}

export function getDashboardStats() {
  return http.get<DashboardStats>('/admin/dashboard/stats')
}

export function getDashboardTrend(days = 30) {
  return http.get<TrendPoint[]>('/admin/dashboard/trend', { params: { days } })
}

/** ---------- 用户管理 ---------- */
export interface AdminUserItem {
  id: number
  nickname: string
  phone: string
  avatarUrl: string
  gender: number
  status: string
  isMember: number
  memberExpireAt: string | null
  bookCount: number
  reviewCount: number
  postCount: number
  lastLoginAt: string | null
  createdAt: string
}

export function getUsers(params: PageQuery) {
  return http.get<PageResult<AdminUserItem>>('/admin/users', { params })
}

export function updateUserStatus(id: number, status: string) {
  return http.patch(`/admin/users/${id}/status`, { status })
}

export function toggleUserMember(id: number, isMember: number) {
  return http.patch(`/admin/users/${id}/member`, { isMember })
}

/** ---------- 书库管理 ---------- */
export interface AdminBookItem {
  id: string
  title: string
  author: string
  isbn: string
  coverUrl: string
  publisher: string
  ratingAvg: string
  ratingCount: number
  shelfCount: number
  status: string
  source: string
  publishedAt: string | null
  createdAt: string
}

export function getBooks(params: PageQuery) {
  return http.get<PageResult<AdminBookItem>>('/admin/books', { params })
}

export function updateBookStatus(id: string, status: string) {
  return http.patch(`/admin/books/${id}/status`, { status })
}

/** ---------- 内容审核 ---------- */
export interface AuditItem {
  id: string
  userId: string
  bookId?: string
  rating?: string
  title?: string
  content: string
  likeCount?: number
  readMinutes?: number
  type?: string
  auditStatus: string
  machineScore: number | null
  isFeatured?: number
  itemCount?: number
  collectCount?: number
  description?: string
  publishedAt: string | null
  createdAt: string
}

export function getModerationReviews(params: PageQuery) {
  return http.get<PageResult<AuditItem>>('/admin/moderation/reviews', { params })
}
export function getModerationPosts(params: PageQuery) {
  return http.get<PageResult<AuditItem>>('/admin/moderation/posts', { params })
}
export function getModerationBooklists(params: PageQuery) {
  return http.get<PageResult<AuditItem>>('/admin/moderation/booklists', { params })
}
export function auditReview(id: string, action: string, reason = '') {
  return http.patch(`/admin/moderation/reviews/${id}`, { action, reason })
}
export function auditPost(id: string, action: string, reason = '') {
  return http.patch(`/admin/moderation/posts/${id}`, { action, reason })
}
export function auditBooklist(id: string, action: string, reason = '') {
  return http.patch(`/admin/moderation/booklists/${id}`, { action, reason })
}

/** ---------- 运营管理 ---------- */
export interface AdminBanner {
  id: string
  title: string
  imageUrl: string
  position: string
  linkType: string
  linkValue: string
  sort: number
  startTime: string | null
  endTime: string | null
  status: string
  createdAt: string
}
export interface AdminColumn {
  id: string
  type: string
  title: string
  subtitle: string
  bookId: string | null
  coverUrl: string
  content: string | null
  sort: number
  status: string
  publishedAt: string | null
  createdAt: string
}
export interface AdminTopic {
  id: string
  title: string
  description: string
  coverUrl: string
  postCount: number
  sort: number
  status: string
  createdAt: string
}

export function getBanners(params: PageQuery = {}) {
  return http.get<PageResult<AdminBanner>>('/admin/banners', { params })
}
export function createBanner(data: Partial<AdminBanner>) {
  return http.post('/admin/banners', data)
}
export function updateBanner(id: string, data: Partial<AdminBanner>) {
  return http.patch(`/admin/banners/${id}`, data)
}
export function deleteBanner(id: string) {
  return http.delete(`/admin/banners/${id}`)
}

export function getColumns(params: PageQuery = {}) {
  return http.get<PageResult<AdminColumn>>('/admin/columns', { params })
}
export function createColumn(data: Partial<AdminColumn>) {
  return http.post('/admin/columns', data)
}
export function updateColumn(id: string, data: Partial<AdminColumn>) {
  return http.patch(`/admin/columns/${id}`, data)
}
export function deleteColumn(id: string) {
  return http.delete(`/admin/columns/${id}`)
}

export function getTopics(params: PageQuery = {}) {
  return http.get<PageResult<AdminTopic>>('/admin/topics', { params })
}
export function createTopic(data: Partial<AdminTopic>) {
  return http.post('/admin/topics', data)
}
export function updateTopic(id: string, data: Partial<AdminTopic>) {
  return http.patch(`/admin/topics/${id}`, data)
}
export function deleteTopic(id: string) {
  return http.delete(`/admin/topics/${id}`)
}

/** ---------- 会员订单与财务 ---------- */
export interface OrderSummary {
  ordersTotal: number
  paidCount: number
  pendingCount: number
  refundedCount: number
  todayPaidCount: number
  revenueFen: number
  revenueTodayFen: number
}
export interface OrderItem {
  id: number
  orderNo: string
  userId: string
  planId: string | null
  orderType: string
  title: string
  amountFen: number
  status: string
  channel: string
  paidAt: string | null
  createdAt: string
}
export interface RedeemItem {
  id: number
  code: string
  batchNo: string
  planId: string
  durationDays: number
  status: string
  usedBy: string | null
  usedAt: string | null
  createdAt: string
}

export function getOrderSummary() {
  return http.get<OrderSummary>('/admin/orders/summary')
}
export function getOrders(params: PageQuery) {
  return http.get<PageResult<OrderItem>>('/admin/orders', { params })
}
export function getRedeemCodes(params: PageQuery) {
  return http.get<PageResult<RedeemItem>>('/admin/redeem-codes', { params })
}
export function generateRedeem(data: { planId: string; durationDays: number; count: number; batchNo?: string }) {
  return http.post<{ batchNo: string; count: number; codes: string[] }>(
    '/admin/redeem-codes/generate',
    data,
  )
}

/** ---------- 系统设置 ---------- */
export interface SettingsOverview {
  profile: {
    id: number
    username: string
    name: string
    avatarUrl: string
    status: string
    lastLoginAt: string | null
  }
  plans: { id: number; code: string; name: string; priceFen: number; durationDays: number }[]
}

export function getSettings() {
  return http.get<SettingsOverview>('/admin/settings')
}
export function updateProfile(data: { name?: string; avatarUrl?: string }) {
  return http.patch('/admin/settings/profile', data)
}
export function changePassword(data: { oldPassword: string; newPassword: string }) {
  return http.post('/admin/settings/password', data)
}

/** ---------- 举报处理 / 申诉复核（P2-12） ---------- */
export interface ReportItem {
  id: number
  reporterId: string
  reporterType: string
  targetType: string
  targetId: string
  reason: string
  description: string
  images: string[]
  status: string
  handlerId: string | null
  handleResult: string
  handledAt: string | null
  createdAt: string
}

export interface AppealItem {
  id: number
  userId: string
  targetType: string
  targetId: string
  moderationLogId: string | null
  reason: string
  status: string
  reviewerId: string | null
  reviewResult: string
  reviewedAt: string | null
  createdAt: string
}

export function getReports(params: PageQuery) {
  return http.get<PageResult<ReportItem>>('/admin/reports', { params })
}
export function handleReport(
  id: number,
  data: { action: 'resolve' | 'reject'; punishLevel?: string; result?: string },
) {
  return http.patch(`/admin/reports/${id}`, data)
}
export function getAppeals(params: PageQuery) {
  return http.get<PageResult<AppealItem>>('/admin/appeals', { params })
}
export function reviewAppeal(id: number, data: { action: 'approve' | 'reject'; result?: string }) {
  return http.patch(`/admin/appeals/${id}`, data)
}

/** ---------- 活动管理（P2-15） ---------- */
export interface AdminEvent {
  id: number
  title: string
  type: string
  coverUrl: string
  description: string
  startTime: string
  endTime: string
  signupStart: string | null
  signupEnd: string | null
  capacity: number
  signupCount: number
  memberOnly: boolean
  status: string
  createdAt: string
}

export function getEvents(params: PageQuery = {}) {
  return http.get<PageResult<AdminEvent>>('/admin/events', { params })
}
export function createEvent(data: Partial<AdminEvent> & { startTime: string; endTime: string }) {
  return http.post('/admin/events', data)
}
export function updateEvent(id: number, data: Partial<AdminEvent>) {
  return http.patch(`/admin/events/${id}`, data)
}
export function updateEventStatus(id: number, status: string) {
  return http.patch(`/admin/events/${id}/status`, { status })
}
export function deleteEvent(id: number) {
  return http.delete(`/admin/events/${id}`)
}

/** ---------- 管理员账号 / 角色 / 操作日志（P2-15） ---------- */
export interface AdminAccount {
  id: number
  username: string
  name: string
  avatarUrl: string
  status: string
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
}

export interface AdminRoleItem {
  id: number
  code: string
  name: string
  description: string
  permissions: string[]
  isBuiltin: boolean
  status: string
}

export interface OperationLogItem {
  id: number
  adminId: string
  username: string
  module: string
  action: string
  method: string
  path: string
  params: Record<string, unknown> | null
  ip: string
  statusCode: number
  durationMs: number
  createdAt: string
}

export function getAccounts(params: PageQuery) {
  return http.get<PageResult<AdminAccount>>('/admin/accounts', { params })
}
export function createAccount(data: {
  username: string
  password: string
  name?: string
  roleCodes?: string[]
}) {
  return http.post('/admin/accounts', data)
}
export function updateAccount(
  id: number,
  data: { name?: string; status?: string; password?: string; roleCodes?: string[] },
) {
  return http.patch(`/admin/accounts/${id}`, data)
}
export function deleteAccount(id: number) {
  return http.delete(`/admin/accounts/${id}`)
}
export function getRoles() {
  return http.get<AdminRoleItem[]>('/admin/roles')
}
export function createRole(data: Partial<AdminRoleItem>) {
  return http.post('/admin/roles', data)
}
export function updateRole(id: number, data: Partial<AdminRoleItem>) {
  return http.patch(`/admin/roles/${id}`, data)
}
export function getOperationLogs(params: PageQuery & { module?: string; adminId?: string }) {
  return http.get<PageResult<OperationLogItem>>('/admin/operation-logs', { params })
}