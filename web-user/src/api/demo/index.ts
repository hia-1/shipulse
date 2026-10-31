import axios from 'axios'
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import {
  annualReview,
  avatar,
  badges,
  bannerCover,
  booklists,
  books,
  categories,
  cover,
  dailyDurations,
  demoUser,
  feedItems,
  feedTopics,
  getBookDetail,
  goals,
  notifications,
  plans,
  reviewAuthors,
  reviews,
  sessions,
  tags,
} from './fixtures'
import type { ReviewComment, ReviewItem } from '../review'
import type { SessionSummary } from '../reading'
import type { FeedItem } from '../feed'
import type { GoalItem } from '../incentive'

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

const now = () => new Date().toISOString()

/** ---------- 可变演示状态 ---------- */
const shelf = new Map<number, 'want' | 'reading' | 'read'>([
  [1, 'reading'],
  [5, 'want'],
  [8, 'read'],
  [10, 'reading'],
])
const progress = new Map<number, number>([
  [1, 96],
  [10, 120],
])
const reviewLikes = new Map<number, boolean>()
const postLikes = new Map<number, boolean>()
const collectedLists = new Set<number>([2])
const notificationList = notifications.map((n) => ({ ...n }))
const goalList = goals.map((g) => ({ ...g }))
const booklistList = booklists.map((b) => ({ ...b, books: [...b.books] }))
const feedList: FeedItem[] = feedItems.map((f) => ({ ...f }))
let ongoing: SessionSummary | null = {
  sessionId: 99,
  bookId: 1,
  bookTitle: books[0].title,
  coverUrl: books[0].coverUrl,
  startTime: new Date(Date.now() - 42 * 60000).toISOString(),
  endTime: null,
  durationSeconds: 42 * 60,
  startPage: 96,
  endPage: 96,
  note: '',
  status: 'ongoing',
}

const reviewComments: Record<number, ReviewComment[]> = {
  1: [
    {
      id: 1,
      parentId: 0,
      replyToUid: 0,
      content: '读到福贵牵着老牛那段，我也哭了。',
      likeCount: 3,
      createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      author: { id: reviewAuthors[2].id, nickname: reviewAuthors[2].nickname, avatarUrl: reviewAuthors[2].avatarUrl },
    },
    {
      id: 2,
      parentId: 1,
      replyToUid: reviewAuthors[2].id,
      replyToNickname: reviewAuthors[2].nickname,
      content: '是啊，最后那段克制得让人难受。',
      likeCount: 1,
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
      author: { id: reviewAuthors[0].id, nickname: reviewAuthors[0].nickname, avatarUrl: reviewAuthors[0].avatarUrl },
    },
  ],
  2: [
    {
      id: 3,
      parentId: 0,
      replyToUid: 0,
      content: '罗辑最后那段真的看得头皮发麻。',
      likeCount: 5,
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      author: { id: reviewAuthors[3].id, nickname: reviewAuthors[3].nickname, avatarUrl: reviewAuthors[3].avatarUrl },
    },
  ],
}

function paged<T>(list: T[], page: number, size: number) {
  const start = (page - 1) * size
  return { list: list.slice(start, start + size), total: list.length, page, pageSize: size }
}

function num(value: unknown, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function str(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function discover() {
  return {
    banners: [
      { id: 1, title: '秋日共读计划', imageUrl: bannerCover('秋日共读', 30), linkType: 'none', linkValue: '' },
      { id: 2, title: '年度会员限时 5 折', imageUrl: bannerCover('年度会员', 200), linkType: 'web', linkValue: '#/membership' },
      { id: 3, title: '本周新书 · 时间简史', imageUrl: bannerCover('新书上架', 260), linkType: 'book', linkValue: '19' },
    ],
    weeklyBooks: [books[0], books[4], books[9], books[16]].map((b, i) => ({
      id: i + 1,
      title: b.title,
      subtitle: b.subtitle,
      coverUrl: b.coverUrl,
      book: b,
    })),
    rankEntries: [
      { key: 'hot', name: '热读榜', books: [...books].sort((a, b) => b.shelfCount - a.shelfCount).slice(0, 10) },
      { key: 'new', name: '新书榜', books: [...books].sort((a, b) => b.id - a.id).slice(0, 10) },
      { key: 'rating', name: '口碑榜', books: [...books].sort((a, b) => b.ratingAvg - a.ratingAvg).slice(0, 10) },
    ],
    hotReviews: reviews.slice(0, 6).map((r) => ({
      id: r.id,
      bookId: r.bookId,
      bookTitle: r.bookTitle,
      coverUrl: r.coverUrl,
      rating: r.rating,
      title: r.title,
      contentPreview: r.content.slice(0, 64),
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      isFeatured: r.isFeatured,
      publishedAt: r.publishedAt,
      author: { nickname: r.author.nickname, isMember: r.author.isMember },
    })),
  }
}

function filterBooks(params: Params) {
  const keyword = str(params.keyword).trim()
  const categoryId = str(params.categoryId)
  const sort = str(params.sort) || 'default'
  let list = books.filter((b) => b.status === 'published')
  if (keyword) {
    list = list.filter((b) => b.title.includes(keyword) || b.author.includes(keyword))
  }
  if (categoryId) {
    list = list.filter((b) => String(b.categoryId) === categoryId)
  }
  if (sort === 'hot') list = [...list].sort((a, b) => b.shelfCount - a.shelfCount)
  else if (sort === 'new') list = [...list].sort((a, b) => b.id - a.id)
  else if (sort === 'rating') list = [...list].sort((a, b) => b.ratingAvg - a.ratingAvg)
  return list
}

function shelfBook(bookId: number, status: 'want' | 'reading' | 'read') {
  const book = books[bookId - 1]
  const page = progress.get(bookId) || (status === 'read' ? book.pages : 0)
  return {
    id: bookId,
    bookId,
    status,
    currentPage: page,
    progress: Math.min(100, Math.round((page / book.pages) * 100)),
    lastReadAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    book: {
      id: book.id,
      title: book.title,
      coverUrl: book.coverUrl,
      author: book.author,
      pages: book.pages,
      ratingAvg: book.ratingAvg,
      categoryName: book.categoryName,
    },
  }
}

function userSessions(params: Params) {
  const page = num(params.page, 1)
  const size = num(params.pageSize, 20)
  return paged(sessions, page, size)
}

function reviewsList(params: Params) {
  const bookId = Number(params.bookId)
  const keyword = str(params.keyword).trim()
  let list = reviews.map((r) => ({ ...r, isLiked: !!reviewLikes.get(r.id) }))
  if (bookId) list = list.filter((r) => r.bookId === bookId)
  if (keyword) list = list.filter((r) => r.title.includes(keyword) || r.content.includes(keyword))
  if (str(params.sort) === 'rating') list = [...list].sort((a, b) => b.rating - a.rating)
  return paged(list, num(params.page, 1), num(params.pageSize, 10))
}

function createReview(body: Params): ReviewItem {
  const book = books[Number(body.bookId) - 1] || books[0]
  const item: ReviewItem = {
    id: reviews.length + 1,
    bookId: book.id,
    bookTitle: book.title,
    coverUrl: book.coverUrl,
    rating: Number(body.rating) || 8,
    title: str(body.title) || '无题',
    content: str(body.content),
    likeCount: 0,
    commentCount: 0,
    auditStatus: 'pending',
    auditReason: '',
    isFeatured: false,
    publishedAt: null,
    createdAt: now(),
    author: { id: demoUser.id, nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl, isMember: true },
    isLiked: false,
    audit: { status: 'pending', reason: '' },
  }
  reviews.unshift(item)
  return item
}

function shareContent(type: string, targetId: number) {
  const book = books[Math.max(0, (targetId || 1) - 1)]
  const card = {
    template: type === 'pulse' ? 'pulse' : type === 'booklist' ? 'booklist' : 'review',
    code: 'demo',
    url: '',
    title: '时脉书社 · 我的阅读记录',
    subtitle: '记录每一次阅读的脉动',
    coverUrl: cover('时脉', 40),
    quote: '把每一次阅读都记成一次呼吸。',
    rating: null as number | null,
    author: { nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl },
    stats: [
      { label: '今年阅读', value: '5173 分钟' },
      { label: '连续打卡', value: '12 天' },
      { label: '读完', value: '14 本' },
    ],
    footer: '时脉书社 · 阅读世界',
  }
  return {
    code: 'demo',
    url: `#/share/demo`,
    card,
    content: {
      type,
      targetId: book.id,
      path: '/',
      title: book.title,
      subtitle: book.subtitle,
      coverUrl: book.coverUrl,
      description: book.description || '',
      quote: '把每一次阅读都记成一次呼吸。',
      rating: book.ratingAvg,
      images: [book.coverUrl],
      author: { id: demoUser.id, nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl },
      stats: [
        { label: '评分', value: String(book.ratingAvg) },
        { label: '在读', value: String(book.readingCount) },
      ],
    },
  }
}

/** ---------- 路由 ---------- */
function handle(method: string, url: string, params: Params, body: Params): unknown {
  const path = url.replace(/^\/api/, '').split('?')[0]

  // 认证 / 用户
  if (path === '/auth/login' || path === '/auth/register') {
    return {
      accessToken: 'demo-access-token',
      refreshToken: 'demo-refresh-token',
      user: demoUser,
    }
  }
  if (path === '/auth/refresh') {
    return { accessToken: 'demo-access-token', refreshToken: 'demo-refresh-token' }
  }
  if (path === '/user/profile' && method === 'get') return demoUser
  if (path === '/user/profile' && method === 'patch') {
    Object.assign(demoUser, body)
    return demoUser
  }
  if (path === '/user/account/cancel') return { deleted: false, id: demoUser.id }

  // 首页
  if (path === '/home/discover') return discover()
  if (path === '/home/rank') {
    const type = str(params.type) || 'hot'
    const list =
      type === 'new'
        ? [...books].sort((a, b) => b.id - a.id)
        : type === 'rating'
          ? [...books].sort((a, b) => b.ratingAvg - a.ratingAvg)
          : [...books].sort((a, b) => b.shelfCount - a.shelfCount)
    return { type, list: list.slice(0, num(params.limit, 10)) }
  }

  // 书库
  if (path === '/library/categories') return categories
  if (path === '/library/tags') return tags
  if (path === '/library/books') {
    return paged(filterBooks(params), num(params.page, 1), num(params.pageSize, 20))
  }
  if (path.startsWith('/library/books/isbn/')) {
    const isbn = path.slice('/library/books/isbn/'.length)
    return books.find((b) => b.isbn === isbn) || null
  }
  if (path.startsWith('/library/books/')) {
    return getBookDetail(Number(path.slice('/library/books/'.length)))
  }

  // 搜索
  if (path === '/search/suggest') {
    const keyword = str(params.keyword).trim()
    return {
      books: keyword ? books.filter((b) => b.title.includes(keyword) || b.author.includes(keyword)).slice(0, num(params.limit, 8)) : [],
      isbnHit: null,
    }
  }
  if (path === '/search/hot') {
    return [
      { keyword: '三体', count: 1280 },
      { keyword: '活着', count: 960 },
      { keyword: '红楼梦', count: 845 },
      { keyword: '人类简史', count: 620 },
      { keyword: '小王子', count: 512 },
    ].slice(0, num(params.limit, 10))
  }
  if (path === '/search/record') return { ok: true }

  // 书架
  if (path === '/bookshelf') {
    const status = str(params.status)
    const ids = [...shelf.keys()].filter((id) => (status ? shelf.get(id) === status : true))
    const list = ids.map((id) => shelfBook(id, shelf.get(id) as 'want' | 'reading' | 'read'))
    return paged(list, num(params.page, 1), num(params.pageSize, 20))
  }
  if (path.startsWith('/bookshelf/status/')) {
    const id = Number(path.slice('/bookshelf/status/'.length))
    return { status: shelf.get(id) || null }
  }
  if (path.startsWith('/bookshelf/') && path.endsWith('/progress')) {
    const id = Number(path.split('/')[2])
    progress.set(id, Number(body.currentPage) || 0)
    return {
      bookId: id,
      currentPage: Number(body.currentPage) || 0,
      progress: Number(body.progress) || 0,
      lastReadAt: now(),
    }
  }
  if (path.startsWith('/bookshelf/')) {
    const id = Number(path.split('/')[2])
    if (method === 'put') {
      shelf.set(id, str(body.status) as 'want' | 'reading' | 'read')
      return { status: shelf.get(id) }
    }
    if (method === 'delete') {
      shelf.delete(id)
      return { ok: true }
    }
  }

  // 阅读计时
  if (path === '/reading/sessions/ongoing') return ongoing
  if (path === '/reading/sessions/today-summary') {
    return { totalSeconds: 110 * 60, sessionCount: 2, bookCount: 2 }
  }
  if (path === '/reading/sessions' && method === 'get') return userSessions(params)
  if (path === '/reading/sessions' && method === 'post') {
    const book = books[Number(body.bookId) - 1] || books[0]
    ongoing = {
      sessionId: 100,
      bookId: book.id,
      bookTitle: book.title,
      coverUrl: book.coverUrl,
      startTime: now(),
      endTime: null,
      durationSeconds: 0,
      startPage: Number(body.startPage) || 0,
      endPage: 0,
      note: '',
      status: 'ongoing',
    }
    return ongoing
  }
  if (path.startsWith('/reading/sessions/') && path.endsWith('/finish')) {
    const id = Number(path.split('/')[3])
    const finished: SessionSummary = {
      ...(ongoing || {
        sessionId: id,
        bookId: 1,
        bookTitle: books[0].title,
        coverUrl: books[0].coverUrl,
        startTime: now(),
        startPage: 0,
        endPage: 0,
      }),
      sessionId: id,
      endTime: now(),
      durationSeconds: Number(body.durationSeconds) || 42 * 60,
      endPage: Number(body.endPage) || 96,
      note: str(body.note),
      status: 'finished',
    }
    sessions.unshift(finished)
    ongoing = null
    return finished
  }
  if (path === '/reading/pulse/daily') return dailyDurations
  if (path === '/reading/pulse/annual') return annualReview
  if (path === '/reading/pulse/export') {
    return {
      csv: '日期,时长(分钟),场次\n' + dailyDurations.map((d) => `${d.date},${Math.round(d.seconds / 60)},${d.sessionCount}`).join('\n'),
    }
  }

  // 书评与社区
  if (path === '/community/reviews/mine') {
    const bookId = Number(params.bookId)
    return reviews.find((r) => r.bookId === bookId) || null
  }
  if (path === '/community/reviews/my') {
    return paged(reviews, num(params.page, 1), num(params.pageSize, 10))
  }
  if (path === '/community/reviews' && method === 'get') return reviewsList(params)
  if (path === '/community/reviews' && method === 'post') return createReview(body)
  if (path.match(/^\/community\/reviews\/\d+\/like$/)) {
    const id = Number(path.split('/')[3])
    const liked = !reviewLikes.get(id)
    reviewLikes.set(id, liked)
    const review = reviews.find((r) => r.id === id)
    return { isLiked: liked, likeCount: (review ? review.likeCount : 0) + (liked ? 1 : 0) }
  }
  if (path.match(/^\/community\/reviews\/\d+\/comments$/)) {
    const id = Number(path.split('/')[3])
    if (method === 'post') {
      const list = reviewComments[id] || (reviewComments[id] = [])
      const item: ReviewComment = {
        id: list.length + 1,
        parentId: Number(body.parentId) || 0,
        replyToUid: 0,
        content: str(body.content),
        likeCount: 0,
        createdAt: now(),
        author: { id: demoUser.id, nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl },
      }
      list.push(item)
      return { ...item, audit: { status: 'approved', reason: '' } }
    }
    return reviewComments[id] || []
  }
  if (path.match(/^\/community\/reviews\/\d+$/) && method === 'get') {
    const id = Number(path.split('/')[3])
    const review = reviews.find((r) => r.id === id)
    return review ? { ...review, isLiked: !!reviewLikes.get(id) } : null
  }
  if (path.match(/^\/community\/reviews\/\d+$/) && method === 'delete') {
    return { deleted: true, id: Number(path.split('/')[3]) }
  }
  if (path === '/community/reports') return { id: 1, status: 'pending' }
  if (path === '/community/appeals') return { id: 1, status: 'pending' }
  if (path === '/community/appeals/mine') {
    return {
      items: [
        {
          id: 1,
          userId: String(demoUser.id),
          targetType: 'review',
          targetId: '3',
          moderationLogId: null,
          reason: '认为审核误判，书评内容并无违规。',
          status: 'rejected',
          reviewerId: 'admin',
          reviewResult: '复核后确认原审核结论无误。',
          reviewedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
        },
      ],
      total: 1,
      page: 1,
      size: 10,
    }
  }

  // 动态流
  if (path === '/feed') {
    const type = str(params.type) || 'all'
    let list = feedList.map((f) => ({ ...f, isLiked: !!postLikes.get(f.id) }))
    if (type !== 'all') list = list.filter((f) => f.kind === type)
    const page = num(params.page, 1)
    const size = num(params.pageSize, 10)
    return {
      list: list.slice((page - 1) * size, page * size),
      total: list.length,
      hotTotal: 128,
      page,
      pageSize: size,
      tabs: [
        { value: 'all', label: '全部' },
        { value: 'checkin', label: '打卡' },
        { value: 'text', label: '图文' },
        { value: 'review', label: '书评' },
        { value: 'booklist', label: '书单' },
      ],
      topicId: null,
      hasMore: page * size < list.length,
    }
  }
  if (path === '/feed/topics') return feedTopics
  if (path === '/posts/today') {
    return { checkedToday: true, todayMinutes: 110, checked: { id: 1, readMinutes: 62 } }
  }
  if (path === '/posts/checkin') {
    const book = books[Number(body.bookId) - 1] || books[0]
    const item: FeedItem = {
      kind: 'checkin',
      id: feedList.length + 1,
      author: { id: demoUser.id, nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl, isMember: true },
      publishedAt: now(),
      content: str(body.content),
      readMinutes: Number(body.readMinutes) || 0,
      book: { id: book.id, title: book.title, coverUrl: book.coverUrl },
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      topicId: body.topicId ? Number(body.topicId) : null,
    }
    feedList.unshift(item)
    return { ...item, audit: { status: 'approved', reason: '' } }
  }
  if (path === '/posts' && method === 'post') {
    const item: FeedItem = {
      kind: 'text',
      id: feedList.length + 1,
      author: { id: demoUser.id, nickname: demoUser.nickname, avatarUrl: demoUser.avatarUrl, isMember: true },
      publishedAt: now(),
      content: str(body.content),
      images: Array.isArray(body.images) ? (body.images as string[]) : [],
      location: str(body.location),
      likeCount: 0,
      commentCount: 0,
      isLiked: false,
      topicId: body.topicId ? Number(body.topicId) : null,
    }
    feedList.unshift(item)
    return { ...item, audit: { status: 'pending', reason: '' } }
  }
  if (path === '/posts/my') {
    return paged(
      feedList.map((f) => ({ ...f, audit: { status: 'approved', reason: '' } })),
      num(params.page, 1),
      num(params.pageSize, 10),
    )
  }
  if (path.match(/^\/posts\/\d+\/like$/)) {
    const id = Number(path.split('/')[2])
    const liked = !postLikes.get(id)
    postLikes.set(id, liked)
    const post = feedList.find((f) => f.id === id)
    return { id, isLiked: liked, likeCount: (post ? post.likeCount : 0) + (liked ? 1 : 0) }
  }
  if (path.match(/^\/posts\/\d+$/) && method === 'delete') {
    return { deleted: true, id: Number(path.split('/')[2]) }
  }

  // 书单
  if (path === '/booklists/square') {
    const q = str(params.q).trim()
    const tag = str(params.tag)
    let list = booklistList.map((b) => ({ ...b, collected: collectedLists.has(b.id) }))
    if (q) list = list.filter((b) => b.title.includes(q) || b.description.includes(q))
    if (tag) list = list.filter((b) => b.books.some((x) => x.title.includes(tag)) || b.title.includes(tag))
    return {
      ...paged(list, num(params.page, 1), num(params.pageSize, 12)),
      tags: ['治愈', '历史', '成长', '科幻'],
    }
  }
  if (path === '/booklists/tags') return ['治愈', '历史', '成长', '科幻', '夜读']
  if (path === '/booklists/my') {
    return {
      created: booklistList.filter((b) => b.creator === demoUser.nickname),
      collected: booklistList.filter((b) => collectedLists.has(b.id)),
    }
  }
  if (path.startsWith('/booklists/book/')) {
    const bookId = Number(path.slice('/booklists/book/'.length))
    return {
      bookId,
      list: booklistList.filter((b) => b.books.some((x) => x.bookId === bookId)).map((b) => ({ ...b, collected: collectedLists.has(b.id) })),
    }
  }
  if (path.match(/^\/booklists\/\d+\/collect$/)) {
    const id = Number(path.split('/')[2])
    if (method === 'post') collectedLists.add(id)
    else collectedLists.delete(id)
    const target = booklistList.find((b) => b.id === id)
    return {
      collected: collectedLists.has(id),
      collectCount: (target ? target.collectCount : 0) + (collectedLists.has(id) ? 1 : 0),
      id,
    }
  }
  if (path.match(/^\/booklists\/\d+\/items\/\d+$/)) {
    return booklistList[0]
  }
  if (path.match(/^\/booklists\/\d+\/items$/)) return booklistList[0]
  if (path === '/booklists' && method === 'post') {
    const created = {
      ...booklistList[0],
      id: booklistList.length + 1,
      title: str(body.title) || '新书单',
      description: str(body.description),
      creator: demoUser.nickname,
      isOfficial: 0,
      collectCount: 0,
      collected: false,
      publishedAt: now(),
      isMine: true,
    }
    booklistList.unshift(created)
    return created
  }
  if (path.match(/^\/booklists\/\d+$/)) {
    const id = Number(path.split('/')[2])
    const target = booklistList.find((b) => b.id === id)
    if (method === 'delete') {
      return { deleted: true, id }
    }
    if (method === 'patch' && target) {
      Object.assign(target, body)
      return { ...target, isMine: true, collected: collectedLists.has(id) }
    }
    return target ? { ...target, isMine: target.creator === demoUser.nickname, collected: collectedLists.has(id) } : null
  }

  // 会员
  if (path === '/membership/plans') return plans
  if (path === '/membership/my') {
    return {
      isMember: true,
      memberExpireAt: demoUser.memberExpireAt,
      plans,
      subscription: {
        status: 'active',
        planName: '年度会员',
        startTime: new Date(Date.now() - 180 * 86400000).toISOString(),
        expireTime: demoUser.memberExpireAt || '',
        autoRenew: true,
        channel: 'sandbox',
      },
    }
  }
  if (path === '/membership/orders') {
    const plan = plans.find((p) => p.id === Number(body.planId)) || plans[0]
    return {
      orderNo: 'SP' + Date.now(),
      planId: plan.id,
      title: plan.name,
      amountFen: plan.priceFen,
      autoRenew: !!body.autoRenew,
      status: 'pending',
    }
  }
  if (path === '/membership/pay/sandbox') {
    return {
      paid: true,
      orderNo: str(body.orderNo),
      amountFen: 16800,
      memberExpireAt: demoUser.memberExpireAt,
      isMember: true,
    }
  }
  if (path === '/membership/trial') {
    return { ok: true, expireTime: demoUser.memberExpireAt || '', planName: '7 天体验会员' }
  }
  if (path === '/membership/redeem') {
    return { ok: true, expireTime: demoUser.memberExpireAt || '', planName: '季度会员' }
  }

  // 激励
  if (path === '/incentive/goals' && method === 'get') return goalList
  if (path === '/incentive/goals' && method === 'post') {
    const item: GoalItem = {
      id: goalList.length + 1,
      goalType: str(body.goalType) === 'monthly' ? 'monthly' : 'yearly',
      period: str(body.period) || '2026',
      targetMinutes: Number(body.targetMinutes) || 900,
      targetBooks: Number(body.targetBooks) || 3,
      actualMinutes: 0,
      actualBooks: 0,
      status: 'ongoing',
      minuteProgress: 0,
      bookProgress: 0,
      achieved: false,
    }
    goalList.push(item)
    return item
  }
  if (path === '/incentive/goals/progress') {
    return { goals: goalList, streak: { currentStreak: 12, longestStreak: 38 } }
  }
  if (path.match(/^\/incentive\/goals\/\d+$/) && method === 'put') {
    const id = Number(path.split('/')[3])
    const goal = goalList.find((g) => g.id === id)
    if (goal) Object.assign(goal, body)
    return goal || null
  }
  if (path === '/incentive/streak') return { currentStreak: 12, longestStreak: 38 }
  if (path === '/incentive/badges') return badges
  if (path === '/incentive/badges/mine') return badges.filter((b) => b.unlocked)
  if (path === '/incentive/badges/check') {
    return { awarded: [{ badgeId: 2, code: 'seven_days', name: '七日不辍' }] }
  }

  // 消息
  if (path === '/notifications') {
    const type = str(params.type)
    const list = type && type !== 'all' ? notificationList.filter((n) => n.category === type) : notificationList
    return paged(list, num(params.page, 1), num(params.pageSize, 20))
  }
  if (path === '/notifications/unread-count') {
    const unread = notificationList.filter((n) => !n.isRead)
    return {
      total: unread.length,
      like: unread.filter((n) => n.category === 'like').length,
      comment: unread.filter((n) => n.category === 'comment').length,
      system: unread.filter((n) => n.category === 'system').length,
    }
  }
  if (path === '/notifications/read-all') {
    const type = str(params.type)
    let updated = 0
    notificationList.forEach((n) => {
      if (!n.isRead && (type === '' || type === 'all' || n.category === type)) {
        n.isRead = true
        n.readAt = now()
        updated += 1
      }
    })
    return { updated }
  }
  if (path.match(/^\/notifications\/\d+\/read$/)) {
    const id = Number(path.split('/')[2])
    const item = notificationList.find((n) => n.id === id)
    if (item) {
      item.isRead = true
      item.readAt = now()
    }
    return { id, isRead: true }
  }

  // 反馈
  if (path === '/feedback' && method === 'post') {
    return { id: 1, status: 'pending', createdAt: now() }
  }
  if (path === '/feedback/mine') {
    return {
      list: [
        {
          id: 1,
          type: 'suggestion',
          content: '希望阅读计时支持手动补录。',
          contact: '138****6688',
          status: 'replied',
          reply: '已列入排期，感谢建议。',
          repliedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
          createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
        },
      ],
      total: 1,
      page: 1,
      size: 10,
    }
  }

  // 分享
  if (path === '/share' && method === 'post') return shareContent(str(body.type), Number(body.targetId))
  if (path.startsWith('/share/')) return { card: shareContent('pulse', 1).card, content: shareContent('pulse', 1).content }

  // 兜底
  return null
}

export const DEMO_ACCESS_TOKEN = 'demo-access-token'
export const DEMO_REFRESH_TOKEN = 'demo-refresh-token'
export { avatar as demoAvatar }

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
