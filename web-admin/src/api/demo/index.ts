import axios from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'

type Params = Record<string, unknown>

function ok<T>(data: T, config: InternalAxiosRequestConfig): AxiosResponse {
  return {
    data: { code: 0, message: 'ok', data },
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }
}

const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString()

function cover(title: string, hue: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},34%,64%)"/><stop offset="1" stop-color="hsl(${hue + 26},30%,34%)"/>` +
    `</linearGradient></defs><rect width="240" height="320" fill="url(#g)"/>` +
    `<text x="120" y="150" font-family="Songti SC,serif" font-size="26" fill="#ffffff" text-anchor="middle" letter-spacing="6">${title}</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

function avatar(name: string, hue: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<circle cx="48" cy="48" r="48" fill="hsl(${hue},40%,58%)"/>` +
    `<text x="48" y="62" font-family="Songti SC,serif" font-size="34" fill="#fff" text-anchor="middle">${name.slice(0, 1)}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

export const demoAdmin = {
  id: 1,
  username: 'admin',
  name: '时脉管理员',
  avatarUrl: avatar('时', 160),
  status: 'active',
  lastLoginAt: daysAgo(0),
  roles: ['super_admin'],
}

const bookTitles = [
  '活着', '百年孤独', '围城', '平凡的世界', '三体', '白夜行', '人类简史', '小王子', '追风筝的人', '红楼梦',
  '月亮与六便士', '解忧杂货店', '万历十五年', '沉默的大多数', '挪威的森林', '边城', '目送', '原则', '时间简史', '城南旧事',
]

const authors = ['余华', '马尔克斯', '钱锺书', '路遥', '刘慈欣', '东野圭吾', '赫拉利', '圣埃克苏佩里', '胡赛尼', '曹雪芹']

const userNames = ['林间读客', '纸上行舟', '深夜书房', '半盏茶', '拾荒的猫', '山月记', '一页之间', '旧时光', '南窗', '书页里的风']

const userList = userNames.map((nickname, i) => ({
  id: 1001 + i,
  nickname,
  phone: `138****${6600 + i * 11}`,
  avatarUrl: avatar(nickname, 20 + i * 33),
  gender: i % 2,
  status: i === 3 ? 'banned' : 'active',
  isMember: i % 3 === 0 ? 1 : 0,
  memberExpireAt: i % 3 === 0 ? daysAgo(-90) : null,
  bookCount: 12 + i * 3,
  reviewCount: 3 + i,
  postCount: 8 + i * 2,
  lastLoginAt: daysAgo(i % 4),
  createdAt: daysAgo(120 + i * 17),
}))

const bookList = bookTitles.map((title, i) => ({
  id: String(i + 1),
  title,
  author: authors[i % authors.length],
  isbn: '9787' + String(100000000 + i * 137).slice(0, 9),
  coverUrl: cover(title, 150 + i * 17),
  publisher: '时脉书社联合出版',
  ratingAvg: (8.2 + (i % 12) / 10).toFixed(1),
  ratingCount: 800 + i * 210,
  shelfCount: 2400 + i * 380,
  status: i % 7 === 0 ? 'offline' : 'published',
  source: 'manual',
  publishedAt: daysAgo(30 + i * 9),
  createdAt: daysAgo(60 + i * 5),
}))

const reviewAudits = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  userId: String(1001 + (i % 10)),
  bookId: String((i % 10) + 1),
  rating: String(8 + (i % 2)),
  title: ['温柔地活着', '宇宙很大，人很小', '婚姻是一座围城', '每个大人都曾是孩子'][i % 4],
  content: '这是一段待审核的书评正文，内容克制而真诚，谈到了阅读时的具体感受与书中细节。',
  likeCount: 3 + i,
  type: 'review',
  auditStatus: i % 4 === 0 ? 'pending' : 'approved',
  machineScore: 0.42 + i * 0.03,
  isFeatured: i % 5 === 0 ? 1 : 0,
  publishedAt: daysAgo(i),
  createdAt: daysAgo(i),
}))

const postAudits = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  userId: String(1001 + (i % 10)),
  content: '今天读了 62 分钟，把《活着》最后三十页读完了。',
  readMinutes: 40 + i * 3,
  type: 'checkin',
  auditStatus: i % 3 === 0 ? 'pending' : 'approved',
  machineScore: 0.55 + i * 0.02,
  publishedAt: daysAgo(i),
  createdAt: daysAgo(i),
}))

const booklistAudits = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  userId: String(1001 + i),
  title: ['秋日共读书单', '给失眠的人', '重新认识中国历史'][i % 3] + ` · ${i + 1}`,
  description: '一份认真整理过的书单，收录了最近读到的好书。',
  itemCount: 6 + i,
  collectCount: 120 + i * 30,
  type: 'booklist',
  auditStatus: 'pending',
  machineScore: 0.6,
  publishedAt: null,
  createdAt: daysAgo(i),
}))

const banners = Array.from({ length: 5 }, (_, i) => ({
  id: String(i + 1),
  title: ['秋日共读计划', '年度会员 5 折', '新书上架 · 时间简史', '世界读书日', '共读营招募'][i],
  imageUrl: cover(['秋日', '会员', '新书', '读书日', '共读'][i], 30 + i * 50),
  position: 'home_top',
  linkType: i % 2 ? 'web' : 'book',
  linkValue: i % 2 ? '/membership' : String(i + 1),
  sort: i + 1,
  startTime: daysAgo(10),
  endTime: daysAgo(-20),
  status: i === 4 ? 'offline' : 'online',
  createdAt: daysAgo(12 + i),
}))

const columns = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  type: ['banner', 'topic', 'book_pick', 'article'][i % 4],
  title: ['本周精选', '编辑手记', '深夜书桌', '读者来信', '新书速递', '旧书重读'][i],
  subtitle: '编辑团队为你挑选',
  bookId: i % 2 ? String(i + 1) : null,
  coverUrl: cover('精选', 80 + i * 40),
  content: i % 4 === 3 ? '这是一篇编辑手记的正文内容。' : null,
  sort: i + 1,
  status: 'online',
  publishedAt: daysAgo(3),
  createdAt: daysAgo(5),
}))

const topics = [
  { id: '1', title: '秋日共读计划', description: '一起把秋天读完', coverUrl: cover('秋日', 28), postCount: 1284, sort: 1, status: 'online', createdAt: daysAgo(9) },
  { id: '2', title: '我的枕边书', description: '每晚睡前翻的那一本', coverUrl: cover('枕边', 250), postCount: 863, sort: 2, status: 'online', createdAt: daysAgo(20) },
  { id: '3', title: '读书打卡 100 天', description: '坚持是一件小事', coverUrl: cover('打卡', 180), postCount: 2145, sort: 3, status: 'online', createdAt: daysAgo(40) },
]

const orders = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  orderNo: 'SP2026' + String(100000 + i * 37),
  userId: String(1001 + (i % 10)),
  planId: String((i % 3) + 1),
  orderType: 'plan',
  title: ['月度会员', '季度会员', '年度会员'][i % 3],
  amountFen: [1800, 4800, 16800][i % 3],
  status: ['paid', 'paid', 'pending', 'refunded'][i % 4],
  channel: ['sandbox', 'wechat', 'alipay'][i % 3],
  paidAt: daysAgo(i),
  createdAt: daysAgo(i + 1),
}))

const redeemCodes = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  code: 'SPR' + String(100000 + i * 11),
  batchNo: 'B20261001',
  planId: String((i % 3) + 1),
  durationDays: [30, 90, 365][i % 3],
  status: i % 4 === 0 ? 'used' : 'unused',
  usedBy: i % 4 === 0 ? String(1001 + i) : null,
  usedAt: i % 4 === 0 ? daysAgo(i) : null,
  createdAt: daysAgo(20 + i),
}))

const reports = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  reporterId: String(1001 + i),
  reporterType: 'user',
  targetType: ['review', 'post', 'comment', 'booklist'][i % 4],
  targetId: String(i + 1),
  reason: ['abuse', 'spam', 'ad', 'porn'][i % 4],
  description: '该内容疑似存在不当信息，请核查。',
  images: [],
  status: i % 3 === 0 ? 'pending' : 'resolved',
  handlerId: i % 3 === 0 ? null : '1',
  handleResult: i % 3 === 0 ? '' : '已处理并告知举报人',
  handledAt: i % 3 === 0 ? null : daysAgo(i),
  createdAt: daysAgo(i + 1),
}))

const appeals = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  userId: String(1001 + i),
  targetType: 'review',
  targetId: String(i + 1),
  moderationLogId: 'ML' + (100 + i),
  reason: '认为审核误判，内容并无违规。',
  status: i % 2 ? 'rejected' : 'pending',
  reviewerId: i % 2 ? '1' : null,
  reviewResult: i % 2 ? '复核后确认原审核结论无误。' : '',
  reviewedAt: i % 2 ? daysAgo(i) : null,
  createdAt: daysAgo(i + 2),
}))

const events = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  title: ['秋日共读营', '《活着》共读', '深夜书房 · 线上分享', '年度阅读盛典', '旧书交换市集', '作者见面会'][i],
  type: ['reading_camp', 'reading_camp', 'webinar', 'ceremony', 'offline', 'offline'][i % 6],
  coverUrl: cover('共读', 40 + i * 45),
  description: '与时脉书社一起，在书里度过一个季节。',
  startTime: daysAgo(-5 + i),
  endTime: daysAgo(-12 + i),
  signupStart: daysAgo(3),
  signupEnd: daysAgo(-2),
  capacity: 200 + i * 50,
  signupCount: 120 + i * 30,
  memberOnly: i % 3 === 0,
  status: ['ongoing', 'upcoming', 'ended'][i % 3],
  createdAt: daysAgo(20 + i),
}))

const accounts: Array<{
  id: number
  username: string
  name: string
  avatarUrl: string
  status: string
  roles: string[]
  lastLoginAt: string | null
  createdAt: string
}> = [
  { id: 1, username: 'admin', name: '时脉管理员', avatarUrl: avatar('时', 160), status: 'active', roles: ['super_admin'], lastLoginAt: daysAgo(0), createdAt: daysAgo(400) },
  { id: 2, username: 'editor', name: '内容编辑', avatarUrl: avatar('编', 90), status: 'active', roles: ['content_admin'], lastLoginAt: daysAgo(2), createdAt: daysAgo(300) },
  { id: 3, username: 'operator', name: '运营专员', avatarUrl: avatar('运', 250), status: 'active', roles: ['operation_admin'], lastLoginAt: daysAgo(5), createdAt: daysAgo(200) },
  { id: 4, username: 'finance', name: '财务专员', avatarUrl: avatar('财', 30), status: 'disabled', roles: ['finance_admin'], lastLoginAt: daysAgo(30), createdAt: daysAgo(150) },
]

const roles = [
  { id: 1, code: 'super_admin', name: '超级管理员', description: '拥有全部权限', permissions: ['*'], isBuiltin: true, status: 'active' },
  { id: 2, code: 'content_admin', name: '内容管理员', description: '负责内容审核与书库', permissions: ['review:audit', 'book:*', 'report:*'], isBuiltin: true, status: 'active' },
  { id: 3, code: 'operation_admin', name: '运营管理员', description: '负责运营与活动', permissions: ['banner:*', 'event:*'], isBuiltin: true, status: 'active' },
  { id: 4, code: 'finance_admin', name: '财务管理员', description: '负责订单与财务', permissions: ['order:*'], isBuiltin: false, status: 'active' },
]

const operationLogs = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  adminId: '1',
  username: 'admin',
  module: ['book', 'moderation', 'order', 'user', 'setting'][i % 5],
  action: ['更新状态', '审核通过', '导出订单', '冻结用户', '修改配置'][i % 5],
  method: ['PATCH', 'PATCH', 'GET', 'PATCH', 'PATCH'][i % 5],
  path: ['/admin/books/1/status', '/admin/moderation/reviews/1', '/admin/orders', '/admin/users/1002/status', '/admin/settings'][i % 5],
  params: null,
  ip: '127.0.0.1',
  statusCode: 200,
  durationMs: 12 + i,
  createdAt: daysAgo(i * 0.2),
}))

function paged<T>(list: T[], params: Params) {
  const page = Number(params.page) || 1
  const size = Number(params.size) || 10
  const start = (page - 1) * size
  return { items: list.slice(start, start + size), total: list.length, page, size }
}

function keywordFilter<T>(list: T[], params: Params, pick: (item: T) => string) {
  const keyword = typeof params.keyword === 'string' ? params.keyword.trim() : ''
  if (!keyword) return list
  return list.filter((item) => pick(item).includes(keyword))
}

function statusFilter<T extends { status: string }>(list: T[], params: Params) {
  return typeof params.status === 'string' && params.status ? list.filter((i) => i.status === params.status) : list
}

/** 审核列表按 auditStatus 过滤（兼容前端传入 status / auditStatus） */
function auditFilter<T extends { auditStatus: string }>(list: T[], params: Params) {
  const status = typeof params.auditStatus === 'string' ? params.auditStatus : typeof params.status === 'string' ? params.status : ''
  return status ? list.filter((i) => i.auditStatus === status) : list
}

/** ---------- 路由 ---------- */
function handle(method: string, url: string, params: Params, body: Params): unknown {
  const path = url.replace(/^\/api/, '').split('?')[0]

  if (path === '/admin/login') {
    return { accessToken: 'demo-admin-token', refreshToken: 'demo-admin-refresh', admin: demoAdmin }
  }
  if (path === '/admin/profile') return demoAdmin

  // 看板
  if (path === '/admin/dashboard/stats') {
    return {
      users: { total: 18620, today: 128, active7d: 3140 },
      books: { total: 1024, published: 968 },
      reviews: { total: 5230, pending: 42 },
      moderation: { reviewsPending: 12, postsPending: 8, booklistsPending: 5 },
      finance: { ordersTotal: 3260, ordersPaid: 2984, pendingCount: 36, revenueFen: 2846000, revenueTodayFen: 18600 },
      members: { active: 4120 },
    }
  }
  if (path === '/admin/dashboard/trend') {
    const days = Number(params.days) || 30
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(now - (days - 1 - i) * 86400000).toISOString().slice(0, 10),
      users: 60 + Math.round(Math.sin(i / 3) * 30) + i,
      orders: 20 + Math.round(Math.cos(i / 4) * 12) + i,
      revenueFen: 120000 + Math.round(Math.sin(i / 2) * 40000) + i * 900,
      reviews: 30 + Math.round(Math.sin(i / 2) * 10),
    }))
  }

  // 用户
  if (path === '/admin/users') {
    return paged(keywordFilter(statusFilter(userList, params), params, (u) => u.nickname + u.phone), params)
  }
  if (path.match(/^\/admin\/users\/\d+\/status$/)) {
    const id = Number(path.split('/')[3])
    const target = userList.find((u) => u.id === id)
    if (target) target.status = String(body.status || 'active')
    return { ok: true }
  }
  if (path.match(/^\/admin\/users\/\d+\/member$/)) {
    const id = Number(path.split('/')[3])
    const target = userList.find((u) => u.id === id)
    if (target) target.isMember = Number(body.isMember) || 0
    return { ok: true }
  }

  // 书库
  if (path === '/admin/books') {
    return paged(keywordFilter(statusFilter(bookList, params), params, (b) => b.title + b.author), params)
  }
  if (path.match(/^\/admin\/books\/[\w-]+\/status$/)) {
    const id = path.split('/')[3]
    const target = bookList.find((b) => b.id === id)
    if (target) target.status = String(body.status || 'published')
    return { ok: true }
  }

  // 内容审核
  if (path === '/admin/moderation/reviews') {
    return paged(auditFilter(reviewAudits, params), params)
  }
  if (path === '/admin/moderation/posts') {
    return paged(auditFilter(postAudits, params), params)
  }
  if (path === '/admin/moderation/booklists') {
    return paged(auditFilter(booklistAudits, params), params)
  }
  if (path.match(/^\/admin\/moderation\/(reviews|posts|booklists)\/[\w-]+$/)) {
    const kind = path.split('/')[3]
    const id = path.split('/')[4]
    const list = kind === 'reviews' ? reviewAudits : kind === 'posts' ? postAudits : booklistAudits
    const target = list.find((item) => item.id === id)
    if (target) target.auditStatus = body.action === 'approve' ? 'approved' : 'rejected'
    return { ok: true }
  }

  // 运营
  if (path === '/admin/banners' && method === 'get') return paged(banners, params)
  if (path === '/admin/banners' && method === 'post') {
    const created = { ...banners[0], ...body, id: String(banners.length + 1), createdAt: new Date().toISOString() }
    banners.unshift(created as (typeof banners)[number])
    return created
  }
  if (path.match(/^\/admin\/banners\/[\w-]+$/)) {
    const id = path.split('/')[3]
    if (method === 'delete') return { deleted: true }
    const target = banners.find((b) => b.id === id)
    if (target) Object.assign(target, body)
    return target
  }
  if (path === '/admin/columns' && method === 'get') return paged(columns, params)
  if (path === '/admin/columns' && method === 'post') {
    const created = { ...columns[0], ...body, id: String(columns.length + 1), createdAt: new Date().toISOString() }
    columns.unshift(created as (typeof columns)[number])
    return created
  }
  if (path.match(/^\/admin\/columns\/[\w-]+$/)) {
    const id = path.split('/')[3]
    if (method === 'delete') return { deleted: true }
    const target = columns.find((c) => c.id === id)
    if (target) Object.assign(target, body)
    return target
  }
  if (path === '/admin/topics' && method === 'get') return paged(topics, params)
  if (path === '/admin/topics' && method === 'post') {
    const created = { ...topics[0], ...body, id: String(topics.length + 1), createdAt: new Date().toISOString() }
    topics.unshift(created as (typeof topics)[number])
    return created
  }
  if (path.match(/^\/admin\/topics\/[\w-]+$/)) {
    const id = path.split('/')[3]
    if (method === 'delete') return { deleted: true }
    const target = topics.find((t) => t.id === id)
    if (target) Object.assign(target, body)
    return target
  }

  // 订单 / 兑换码
  if (path === '/admin/orders/summary') {
    return {
      ordersTotal: 3260,
      paidCount: 2984,
      pendingCount: 36,
      refundedCount: 12,
      todayPaidCount: 42,
      revenueFen: 2846000,
      revenueTodayFen: 18600,
    }
  }
  if (path === '/admin/orders') {
    const list = keywordFilter(statusFilter(orders, params), params, (o) => o.orderNo + o.title + o.userId)
    return paged(list, params)
  }
  if (path === '/admin/redeem-codes' && method === 'get') {
    return paged(statusFilter(redeemCodes, params), params)
  }
  if (path === '/admin/redeem-codes/generate') {
    const count = Number(body.count) || 5
    const batchNo = typeof body.batchNo === 'string' && body.batchNo ? body.batchNo : 'B' + Date.now()
    const codes = Array.from({ length: count }, (_, i) => 'SPR' + (Date.now() % 100000) + i)
    return { batchNo, count, codes }
  }

  // 设置
  if (path === '/admin/settings') {
    return {
      profile: {
        id: demoAdmin.id,
        username: demoAdmin.username,
        name: demoAdmin.name,
        avatarUrl: demoAdmin.avatarUrl,
        status: demoAdmin.status,
        lastLoginAt: demoAdmin.lastLoginAt,
      },
      plans: [
        { id: 1, code: 'monthly', name: '月度会员', priceFen: 1800, durationDays: 30 },
        { id: 2, code: 'quarterly', name: '季度会员', priceFen: 4800, durationDays: 90 },
        { id: 3, code: 'yearly', name: '年度会员', priceFen: 16800, durationDays: 365 },
      ],
    }
  }
  if (path === '/admin/settings/profile') {
    if (typeof body.name === 'string') demoAdmin.name = body.name
    return { ok: true }
  }
  if (path === '/admin/settings/password') return { ok: true }

  // 举报 / 申诉
  if (path === '/admin/reports') return paged(keywordFilter(statusFilter(reports, params), params, (r) => r.reason + r.description), params)
  if (path.match(/^\/admin\/reports\/\d+$/)) {
    const id = Number(path.split('/')[3])
    const target = reports.find((r) => r.id === id)
    if (target) {
      target.status = body.action === 'resolve' ? 'resolved' : 'rejected'
      target.handleResult = String(body.result || target.handleResult)
      target.handledAt = new Date().toISOString()
    }
    return { ok: true }
  }
  if (path === '/admin/appeals') return paged(statusFilter(appeals, params), params)
  if (path.match(/^\/admin\/appeals\/\d+$/)) {
    const id = Number(path.split('/')[3])
    const target = appeals.find((a) => a.id === id)
    if (target) {
      target.status = body.action === 'approve' ? 'approved' : 'rejected'
      target.reviewResult = String(body.result || '')
      target.reviewedAt = new Date().toISOString()
      target.reviewerId = '1'
    }
    return { ok: true }
  }

  // 活动
  if (path === '/admin/events' && method === 'get') {
    return paged(keywordFilter(statusFilter(events, params), params, (e) => e.title), params)
  }
  if (path === '/admin/events' && method === 'post') {
    const created = { ...events[0], ...body, id: events.length + 1, createdAt: new Date().toISOString() }
    events.unshift(created as (typeof events)[number])
    return created
  }
  if (path.match(/^\/admin\/events\/\d+\/status$/)) {
    const id = Number(path.split('/')[3])
    const target = events.find((e) => e.id === id)
    if (target) target.status = String(body.status || target.status)
    return { ok: true }
  }
  if (path.match(/^\/admin\/events\/\d+$/)) {
    const id = Number(path.split('/')[3])
    if (method === 'delete') return { deleted: true }
    const target = events.find((e) => e.id === id)
    if (target) Object.assign(target, body)
    return target
  }

  // 管理员账号 / 角色 / 日志
  if (path === '/admin/accounts' && method === 'get') {
    return paged(keywordFilter(statusFilter(accounts, params), params, (a) => a.username + a.name), params)
  }
  if (path === '/admin/accounts' && method === 'post') {
    const created = {
      id: accounts.length + 1,
      username: String(body.username || 'new-admin'),
      name: String(body.name || '新管理员'),
      avatarUrl: avatar('新', 60),
      status: 'active',
      roles: Array.isArray(body.roleCodes) ? (body.roleCodes as string[]) : ['content_admin'],
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    }
    accounts.push(created)
    return created
  }
  if (path.match(/^\/admin\/accounts\/\d+$/)) {
    const id = Number(path.split('/')[3])
    if (method === 'delete') return { deleted: true }
    const target = accounts.find((a) => a.id === id)
    if (target) Object.assign(target, body)
    return target
  }
  if (path === '/admin/roles' && method === 'get') return roles
  if (path === '/admin/roles' && method === 'post') {
    const created = {
      id: roles.length + 1,
      code: String(body.code || 'custom_role'),
      name: String(body.name || '自定义角色'),
      description: String(body.description || ''),
      permissions: Array.isArray(body.permissions) ? (body.permissions as string[]) : [],
      isBuiltin: false,
      status: 'active',
    }
    roles.push(created)
    return created
  }
  if (path.match(/^\/admin\/roles\/\d+$/)) {
    const id = Number(path.split('/')[3])
    const target = roles.find((r) => r.id === id)
    if (target) Object.assign(target, body)
    return target
  }
  if (path === '/admin/operation-logs') return paged(operationLogs, params)

  return null
}

export const DEMO_ADMIN_TOKEN = 'demo-admin-token'
export const DEMO_ADMIN_REFRESH = 'demo-admin-refresh'

/** 安装 demo 适配器：拦截所有请求，返回内置演示数据 */
export function installDemo() {
  const adapter: AxiosAdapter = (config) => {
    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''
    const params = (config.params || {}) as Params
    let body: Params = {}
    if (typeof config.data === 'string' && config.data) {
      try {
        body = JSON.parse(config.data) as Params
      } catch {
        body = {}
      }
    } else if (config.data && typeof config.data === 'object') {
      body = config.data as Params
    }
    return new Promise((resolve) => {
      setTimeout(() => resolve(ok(handle(method, url, params, body), config)), 120)
    })
  }
  axios.defaults.adapter = adapter
  return adapter
}
