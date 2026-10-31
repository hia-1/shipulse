import type { BookItem, BookDetail, CategoryChild, TagItem } from '../library'
import type { ReviewItem } from '../review'
import type { FeedItem, FeedTopic } from '../feed'
import type { BooklistCard, BooklistItemView } from '../booklist'
import type { Plan } from '../membership'
import type { BadgeItem, GoalItem } from '../incentive'
import type { NotificationItem } from '../notification'
import type { DailyDuration, SessionSummary } from '../reading'
import type { UserInfo } from '../auth'

/** 稳定哈希：同一书名始终得到同一套配色与构图 */
function hashOf(text: string) {
  let h = 7
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 9973
  return h
}

const escapeXml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const COVER_FONT = "'Songti SC','Noto Serif CJK SC',SimSun,serif"

/**
 * 书籍封面（240×320，3:4）
 * 纸感渐变底 + 抽象几何 + 竖排书名 + 书脊 / 烫金细线，全部由 SVG 生成，不依赖外网图片
 */
export function cover(title: string, hue: number) {
  const seed = hashOf(title)
  const variant = seed % 3
  const chars = Array.from(title).slice(0, 5)
  const size = chars.length <= 2 ? 42 : chars.length === 3 ? 34 : 28
  const gap = Math.round(size * 1.2)
  const startY = 168 - ((chars.length - 1) * gap) / 2
  const accent = 'rgba(226,200,138,.9)'

  const art =
    variant === 0
      ? `<circle cx="198" cy="72" r="88" fill="url(#glow)"/>` +
        `<path d="M 8 300 L 128 186" stroke="rgba(255,255,255,.22)" stroke-width="1"/>` +
        `<path d="M 8 316 L 146 186" stroke="rgba(255,255,255,.14)" stroke-width="1"/>` +
        `<path d="M 8 284 L 112 186" stroke="rgba(255,255,255,.14)" stroke-width="1"/>`
      : variant === 1
        ? `<circle cx="66" cy="96" r="70" fill="url(#glow)"/>` +
          `<rect y="216" width="240" height="104" fill="hsl(${hue + 34},32%,20%)" opacity=".55"/>` +
          `<rect x="20" y="212" width="200" height="1" fill="${accent}"/>`
        : `<rect width="240" height="320" fill="url(#lines)" opacity=".22"/>` +
          `<rect x="58" y="210" width="42" height="42" fill="none" stroke="rgba(255,255,255,.34)" transform="rotate(45 79 231)"/>` +
          `<circle cx="196" cy="84" r="80" fill="url(#glow)"/>`

  const titleSvg = chars
    .map(
      (char, i) =>
        `<text x="170" y="${(startY + i * gap + 1).toFixed(1)}" font-family="${COVER_FONT}" font-size="${size}" ` +
        `text-anchor="middle" fill="rgba(16,24,22,.35)">${escapeXml(char)}</text>` +
        `<text x="169" y="${(startY + i * gap).toFixed(1)}" font-family="${COVER_FONT}" font-size="${size}" ` +
        `text-anchor="middle" fill="rgba(255,255,255,.95)">${escapeXml(char)}</text>`,
    )
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},28%,80%)"/>` +
    `<stop offset=".52" stop-color="hsl(${hue + 12},34%,55%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 28},36%,28%)"/>` +
    `</linearGradient>` +
    `<radialGradient id="glow" cx=".5" cy=".5" r=".5">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="spine" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="rgba(16,22,20,.5)"/>` +
    `<stop offset="1" stop-color="rgba(16,22,20,0)"/>` +
    `</linearGradient>` +
    `<pattern id="lines" width="240" height="9" patternUnits="userSpaceOnUse">` +
    `<rect y=".5" width="240" height=".6" fill="rgba(255,255,255,.5)"/>` +
    `</pattern>` +
    `<pattern id="grain" width="5" height="5" patternUnits="userSpaceOnUse">` +
    `<circle cx="1" cy="1" r=".7" fill="rgba(255,255,255,.35)"/>` +
    `<circle cx="4" cy="3" r=".5" fill="rgba(0,0,0,.25)"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="240" height="320" fill="url(#bg)"/>` +
    `<rect width="240" height="320" fill="url(#grain)" opacity=".18"/>` +
    art +
    `<rect width="12" height="320" fill="url(#spine)"/>` +
    `<rect x="11.4" width=".8" height="320" fill="rgba(255,255,255,.22)"/>` +
    `<rect x="20" y="20" width="200" height="280" fill="none" stroke="rgba(255,255,255,.32)" stroke-width=".9"/>` +
    `<rect x="134" y="${(startY - size).toFixed(1)}" width="1.2" ` +
    `height="${(gap * (chars.length - 1) + size * 0.9).toFixed(1)}" fill="${accent}"/>` +
    titleSvg +
    `<text x="120" y="291" font-family="Helvetica,Arial,sans-serif" font-size="7" letter-spacing="3.2" ` +
    `text-anchor="middle" fill="rgba(255,255,255,.55)">SHIPULSE</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/**
 * 首页横幅（1200×480）：深色书卷质感 + 抽象书脊群 + 烫金细线
 * 文案由页面叠加，所以画面只做氛围，不再重复大字
 */
export function bannerCover(title: string, hue: number) {
  const seed = hashOf(title)
  const spines = [0, 1, 2, 3, 4]
    .map((i) => {
      const w = 20 + ((seed + i * 7) % 16)
      const h = 150 + ((seed + i * 13) % 70)
      const x = 936 + i * 36
      const y = 150 + ((seed + i * 11) % 46)
      const opacity = (0.08 + i * 0.02).toFixed(2)
      return (
        `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" ` +
        `fill="rgba(255,255,255,${opacity})" transform="rotate(-8 ${x + w / 2} ${y + h})"/>`
      )
    })
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="480" viewBox="0 0 1200 480">` +
    `<defs>` +
    `<linearGradient id="b" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},30%,17%)"/>` +
    `<stop offset=".6" stop-color="hsl(${hue + 18},34%,28%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 38},32%,14%)"/>` +
    `</linearGradient>` +
    `<radialGradient id="r" cx=".5" cy=".5" r=".5">` +
    `<stop offset="0" stop-color="#ffffff" stop-opacity=".22"/>` +
    `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="1200" height="480" fill="url(#b)"/>` +
    `<circle cx="1020" cy="150" r="230" fill="url(#r)"/>` +
    `<circle cx="1020" cy="150" r="188" fill="none" stroke="rgba(255,255,255,.16)" stroke-width="1.2"/>` +
    `<circle cx="1020" cy="150" r="126" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="1"/>` +
    spines +
    `<rect x="64" y="76" width="210" height="1" fill="rgba(226,200,138,.55)"/>` +
    `<text x="64" y="62" font-family="Helvetica,Arial,sans-serif" font-size="16" letter-spacing="6" ` +
    `fill="rgba(255,255,255,.5)">SHIPULSE READING CLUB</text>` +
    `</svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

/** 生成首字母头像 */
export function avatar(name: string, hue: number) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">` +
    `<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},40%,66%)"/>` +
    `<stop offset="1" stop-color="hsl(${hue + 30},38%,42%)"/></linearGradient></defs>` +
    `<circle cx="48" cy="48" r="48" fill="url(#a)"/>` +
    `<text x="48" y="62" font-family="Songti SC,serif" font-size="34" fill="#fff" ` +
    `text-anchor="middle">${name.slice(0, 1)}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const now = Date.now()
const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString()
const hoursAgo = (n: number) => new Date(now - n * 3600000).toISOString()

export const demoUser: UserInfo = {
  id: 1001,
  phone: '138****6688',
  nickname: '林间读客',
  avatarUrl: avatar('林', 168),
  gender: 1,
  bio: '把每一次阅读都记成一次呼吸。',
  status: 'active',
  isMember: 1,
  memberExpireAt: daysAgo(-180),
  bookCount: 26,
  reviewCount: 14,
  postCount: 39,
  followerCount: 128,
  followingCount: 42,
  createdAt: daysAgo(420),
}

interface RawBook {
  title: string
  subtitle: string
  author: string
  category: string
  rating: number
  pages: number
}

const rawBooks: RawBook[] = [
  { title: '活着', subtitle: '在苦难里活着的人', author: '余华', category: '文学小说', rating: 9.4, pages: 191 },
  { title: '百年孤独', subtitle: '布恩迪亚家族的百年', author: '加西亚·马尔克斯', category: '文学小说', rating: 9.3, pages: 360 },
  { title: '围城', subtitle: '围在城里的人想逃出来', author: '钱锺书', category: '文学小说', rating: 9.1, pages: 359 },
  { title: '平凡的世界', subtitle: '普通人的奋斗与尊严', author: '路遥', category: '文学小说', rating: 9.0, pages: 1631 },
  { title: '三体', subtitle: '地球往事的开端', author: '刘慈欣', category: '科幻科普', rating: 9.3, pages: 302 },
  { title: '白夜行', subtitle: '只希望能手牵手在太阳下散步', author: '东野圭吾', category: '悬疑推理', rating: 9.1, pages: 467 },
  { title: '人类简史', subtitle: '从动物到上帝', author: '尤瓦尔·赫拉利', category: '社科历史', rating: 9.0, pages: 440 },
  { title: '小王子', subtitle: '献给还是孩子的你', author: '圣埃克苏佩里', category: '少儿童书', rating: 9.1, pages: 120 },
  { title: '追风筝的人', subtitle: '为你，千千万万遍', author: '卡勒德·胡赛尼', category: '文学小说', rating: 8.9, pages: 362 },
  { title: '红楼梦', subtitle: '中国古典小说巅峰', author: '曹雪芹', category: '文学小说', rating: 9.6, pages: 1606 },
  { title: '月亮与六便士', subtitle: '满地都是六便士，他却抬头看见了月亮', author: '毛姆', category: '文学小说', rating: 8.9, pages: 294 },
  { title: '解忧杂货店', subtitle: '现代人的心灵治愈所', author: '东野圭吾', category: '文学小说', rating: 8.6, pages: 291 },
  { title: '万历十五年', subtitle: '公元 1587，无关紧要的一年', author: '黄仁宇', category: '社科历史', rating: 8.9, pages: 285 },
  { title: '沉默的大多数', subtitle: '王小波杂文自选集', author: '王小波', category: '人文随笔', rating: 9.0, pages: 307 },
  { title: '挪威的森林', subtitle: '青春与爱的失落', author: '村上春树', category: '文学小说', rating: 8.4, pages: 380 },
  { title: '边城', subtitle: '湘西的水与人事', author: '沈从文', category: '文学小说', rating: 8.7, pages: 168 },
  { title: '目送', subtitle: '关于亲情与时间', author: '龙应台', category: '人文随笔', rating: 8.8, pages: 268 },
  { title: '原则', subtitle: '生活与工作的人生原则', author: '瑞·达利欧', category: '经管成长', rating: 8.4, pages: 576 },
  { title: '时间简史', subtitle: '从大爆炸到黑洞', author: '史蒂芬·霍金', category: '科幻科普', rating: 8.9, pages: 210 },
  { title: '城南旧事', subtitle: '童年记忆里的北京城南', author: '林海音', category: '少儿童书', rating: 9.0, pages: 210 },
]

const categoryNames = ['文学小说', '人文随笔', '社科历史', '科幻科普', '悬疑推理', '经管成长', '少儿童书']

export const books: BookItem[] = rawBooks.map((raw, i) => {
  const categoryId = categoryNames.indexOf(raw.category) + 1
  return {
    id: i + 1,
    isbn: '9787' + String(100000000 + i * 137).slice(0, 9),
    title: raw.title,
    subtitle: raw.subtitle,
    author: raw.author,
    translator: '',
    publisher: '时脉书社联合出版',
    publishedDate: `${2015 + (i % 8)}-0${(i % 9) + 1}-01`,
    pages: raw.pages,
    coverUrl: cover(raw.title, 150 + i * 17),
    description: `《${raw.title}》——${raw.subtitle}。这是一本值得反复阅读的作品，${raw.author}用克制的笔触写下了时间里的人与事，读来让人久久不能平静。`,
    categoryId,
    categoryName: raw.category,
    ratingAvg: raw.rating,
    ratingCount: 1200 + i * 319,
    reviewCount: 60 + i * 23,
    shelfCount: 3200 + i * 417,
    wantCount: 880 + i * 97,
    readingCount: 210 + i * 31,
    finishedCount: 960 + i * 71,
    status: 'published',
    publishedAt: daysAgo(30 + i * 12),
    createdAt: daysAgo(160 + i * 9),
  }
})

export function getBookDetail(id: number): BookDetail | null {
  const book = books.find((b) => b.id === id)
  if (!book) return null
  return {
    ...book,
    tags: [
      { id: 1, name: '经典' },
      { id: 2, name: '治愈' },
    ],
  }
}

export const categories: CategoryChild[] = categoryNames.map((name, i) => ({
  id: i + 1,
  parentId: 0,
  name,
  iconUrl: '',
  sort: i + 1,
  bookCount: books.filter((b) => b.categoryId === i + 1).length,
  children: [],
}))

export const tags: TagItem[] = ['经典', '治愈', '悬疑', '成长', '历史', '科幻', '哲学', '女性'].map(
  (name, i) => ({ id: i + 1, name, useCount: 120 - i * 9 }),
)

export const reviewAuthors = [
  { id: 2001, nickname: '纸上行舟', avatarUrl: avatar('纸', 30), isMember: true },
  { id: 2002, nickname: '深夜书房', avatarUrl: avatar('深', 205), isMember: false },
  { id: 2003, nickname: '半盏茶', avatarUrl: avatar('半', 95), isMember: true },
  { id: 2004, nickname: '拾荒的猫', avatarUrl: avatar('拾', 265), isMember: false },
]

const reviewSeeds: Array<[number, number, string, string]> = [
  [1, 9, '活着，是一种温柔的抵抗', '读完《活着》，我才明白福贵的一生不是在讲苦难，而是在讲一个人如何把苦难一件件放下，然后继续活着。'],
  [5, 9, '宇宙很大，人很小', '黑暗森林法则让人后背发凉，但真正打动我的是罗辑在最后那句「给岁月以文明」。'],
  [6, 8, '太阳底下没有新鲜事', '东野圭吾把两个人的一生写成了一场没有尽头的夜里行走，读完很久都缓不过来。'],
  [8, 9, '每个大人都曾是孩子', '重读《小王子》，才发现那些以为是童话的句子，其实句句都在讲成年人。'],
  [10, 10, '一场读不完的梦', '每一次重读红楼梦，都会在不同的位置上停下来，像在旧宅里重新走一遍。'],
  [13, 8, '制度的困局与人', '万历十五年把一个看似平淡的年份拆开，露出整个王朝的骨架。'],
  [9, 9, '为你，千千万万遍', '关于救赎与勇气，读到哈桑那段时在地铁上没忍住眼泪。'],
  [3, 9, '婚姻是一座围城', '钱锺书的幽默像刀，笑着笑着就割到了自己。'],
]

export const reviews: ReviewItem[] = reviewSeeds.map(([bookId, rating, title, content], i) => {
  const book = books[bookId - 1]
  const author = reviewAuthors[i % reviewAuthors.length]
  return {
    id: i + 1,
    bookId,
    bookTitle: book.title,
    coverUrl: book.coverUrl,
    rating,
    title,
    content,
    likeCount: 128 - i * 9,
    commentCount: 12 + i * 2,
    auditStatus: 'approved',
    auditReason: '',
    isFeatured: i < 3,
    publishedAt: daysAgo(i + 1),
    createdAt: daysAgo(i + 1),
    author,
    isLiked: false,
    audit: { status: 'approved', reason: '' },
  }
})

export const feedTopics: FeedTopic[] = [
  { id: 1, title: '秋日共读计划', description: '一起把秋天读完', coverUrl: cover('秋日', 28), postCount: 1284 },
  { id: 2, title: '我的枕边书', description: '每晚睡前翻的那一本', coverUrl: cover('枕边', 250), postCount: 863 },
  { id: 3, title: '读书打卡 100 天', description: '坚持是一件小事', coverUrl: cover('打卡', 180), postCount: 2145 },
]

export const feedItems: FeedItem[] = [
  {
    kind: 'checkin',
    id: 1,
    author: { id: 2001, nickname: '纸上行舟', avatarUrl: avatar('纸', 30), isMember: true },
    publishedAt: hoursAgo(1),
    content: '今天在书房读了 62 分钟，把《活着》最后三十页读完了。',
    readMinutes: 62,
    book: { id: 1, title: '活着', coverUrl: books[0].coverUrl },
    likeCount: 42,
    commentCount: 6,
    isLiked: false,
    topicId: 1,
  },
  {
    kind: 'review',
    id: 2,
    author: reviewAuthors[1],
    publishedAt: hoursAgo(3),
    title: '宇宙很大，人很小',
    content: '黑暗森林法则让人后背发凉，但真正打动我的是罗辑在最后那句「给岁月以文明」。',
    rating: 9,
    book: { id: 5, title: '三体', coverUrl: books[4].coverUrl },
    likeCount: 96,
    commentCount: 18,
    isLiked: false,
  },
  {
    kind: 'text',
    id: 3,
    author: reviewAuthors[2],
    publishedAt: hoursAgo(6),
    content: '下午在窗边读完《目送》，忽然想给很久没联系的妈妈打个电话。',
    images: [cover('目送', 200)],
    location: '杭州 · 湖畔书房',
    likeCount: 58,
    commentCount: 9,
    isLiked: true,
  },
  {
    kind: 'booklist',
    id: 4,
    author: reviewAuthors[3],
    publishedAt: hoursAgo(10),
    title: '给失眠的人：八本适合深夜读的书',
    content: '不刺激，不悬疑，只是安静地陪你把这一夜过完。',
    itemCount: 8,
    collectCount: 320,
    likeCount: 74,
    commentCount: 11,
    isLiked: false,
  },
  {
    kind: 'checkin',
    id: 5,
    author: { id: 2005, nickname: '山月记', avatarUrl: avatar('山', 140), isMember: false },
    publishedAt: hoursAgo(14),
    content: '雨天适合读诗，今天读了四十分钟。',
    readMinutes: 40,
    book: { id: 17, title: '目送', coverUrl: books[16].coverUrl },
    likeCount: 21,
    commentCount: 3,
    isLiked: false,
  },
  {
    kind: 'review',
    id: 6,
    author: reviewAuthors[0],
    publishedAt: daysAgo(1),
    title: '每个大人都曾是孩子',
    content: '重读《小王子》，才发现那些以为是童话的句子，其实句句都在讲成年人。',
    rating: 9,
    book: { id: 8, title: '小王子', coverUrl: books[7].coverUrl },
    likeCount: 152,
    commentCount: 26,
    isLiked: false,
  },
  {
    kind: 'text',
    id: 7,
    author: { id: 2006, nickname: '一页之间', avatarUrl: avatar('一', 320), isMember: true },
    publishedAt: daysAgo(1),
    content: '整理了一下这个月的读书笔记，一共 6 本，最喜欢《万历十五年》。',
    likeCount: 33,
    commentCount: 5,
    isLiked: false,
    topicId: 3,
  },
]

interface DemoBooklist extends BooklistCard {
  books: BooklistItemView[]
}

export const booklists: DemoBooklist[] = [
  {
    id: 1,
    title: '秋日共读书单',
    description: '适合在这个季节慢慢读完的十本书。',
    coverUrl: cover('秋日', 28),
    itemCount: 10,
    collectCount: 1280,
    isOfficial: 1,
    creator: '时脉书社',
    publishedAt: daysAgo(2),
    collected: false,
    books: books.slice(0, 10).map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      note: '适合在傍晚读上一章。',
    })),
  },
  {
    id: 2,
    title: '给失眠的人',
    description: '安静的夜晚，需要一些不吵闹的书。',
    coverUrl: cover('夜读', 250),
    itemCount: 8,
    collectCount: 960,
    isOfficial: 0,
    creator: '深夜书房',
    publishedAt: daysAgo(5),
    collected: true,
    books: [books[7], books[16], books[15], books[11]].map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      note: '睡前读到困。',
    })),
  },
  {
    id: 3,
    title: '重新认识中国历史',
    description: '从细节里看见一个大时代。',
    coverUrl: cover('历史', 190),
    itemCount: 6,
    collectCount: 640,
    isOfficial: 1,
    creator: '时脉书社',
    publishedAt: daysAgo(9),
    collected: false,
    books: [books[12], books[9], books[3]].map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      note: '',
    })),
  },
  {
    id: 4,
    title: '我的一年读书清单',
    description: '2026 年读过的书，挑出最想推荐的几本。',
    coverUrl: cover('一年', 120),
    itemCount: 12,
    collectCount: 210,
    isOfficial: 0,
    creator: '林间读客',
    publishedAt: daysAgo(16),
    collected: false,
    books: books.slice(0, 5).map((b) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      coverUrl: b.coverUrl,
      note: '',
    })),
  },
]

export const notifications: NotificationItem[] = [
  {
    id: 1,
    type: 'like',
    category: 'like',
    title: '你的书评收到新的赞',
    content: '「活着，是一种温柔的抵抗」收到 12 个新的赞。',
    senderId: '2001',
    sender: { id: 2001, nickname: '纸上行舟', avatarUrl: avatar('纸', 30) },
    targetType: 'review',
    targetId: '1',
    isRead: false,
    readAt: null,
    createdAt: hoursAgo(2),
  },
  {
    id: 2,
    type: 'comment',
    category: 'comment',
    title: '有人评论了你的书评',
    content: '半盏茶：读到福贵牵着老牛那段，我也哭了。',
    senderId: '2003',
    sender: { id: 2003, nickname: '半盏茶', avatarUrl: avatar('半', 95) },
    targetType: 'review',
    targetId: '1',
    isRead: false,
    readAt: null,
    createdAt: hoursAgo(5),
  },
  {
    id: 3,
    type: 'system',
    category: 'system',
    title: '阅读目标提醒',
    content: '本月还剩 6 天，你已阅读 520 分钟，加油。',
    senderId: '0',
    sender: null,
    targetType: 'none',
    targetId: '',
    isRead: false,
    readAt: null,
    createdAt: hoursAgo(20),
  },
  {
    id: 4,
    type: 'order',
    category: 'system',
    title: '会员开通成功',
    content: '年度会员已开通，有效期至 2027-04-28。',
    senderId: '0',
    sender: null,
    targetType: 'none',
    targetId: '',
    isRead: true,
    readAt: hoursAgo(18),
    createdAt: daysAgo(1),
  },
  {
    id: 5,
    type: 'audit',
    category: 'system',
    title: '书评审核通过',
    content: '你的书评「宇宙很大，人很小」已通过审核。',
    senderId: '0',
    sender: null,
    targetType: 'review',
    targetId: '2',
    isRead: true,
    readAt: daysAgo(2),
    createdAt: daysAgo(3),
  },
]

export const plans: Plan[] = [
  {
    id: 1,
    code: 'monthly',
    name: '月度会员',
    description: '按月订阅，随时可停',
    priceFen: 1800,
    originalPriceFen: 2500,
    durationDays: 30,
    benefits: ['全站书籍畅读', '时脉报告完整版', '专属书单推荐'],
  },
  {
    id: 2,
    code: 'quarterly',
    name: '季度会员',
    description: '三个月，读完一个季节',
    priceFen: 4800,
    originalPriceFen: 7500,
    durationDays: 90,
    benefits: ['全站书籍畅读', '时脉报告完整版', '专属书单推荐', '共读营优先报名'],
  },
  {
    id: 3,
    code: 'yearly',
    name: '年度会员',
    description: '最划算的选择',
    priceFen: 16800,
    originalPriceFen: 30000,
    durationDays: 365,
    benefits: ['全站书籍畅读', '时脉报告完整版', '专属书单推荐', '共读营优先报名', '年度阅读实体纪念册'],
  },
]

const badgeSeeds: Array<[string, string, string, string, boolean]> = [
  ['first_read', '第一缕脉动', '完成第一次阅读计时', '初次阅读', true],
  ['seven_days', '七日不辍', '连续阅读 7 天', '坚持', true],
  ['thirty_days', '三十日如一日', '连续阅读 30 天', '坚持', false],
  ['ten_books', '十卷在手', '读完 10 本书', '数量', true],
  ['night_owl', '夜读者', '在 0 点后仍阅读', '时刻', true],
  ['reviewer', '执笔人', '发布 10 篇书评', '创作', false],
  ['collector', '藏书人', '书架收藏 50 本书', '收藏', false],
  ['early_bird', '晨读者', '在 6 点前开始阅读', '时刻', false],
]

export const badges: BadgeItem[] = badgeSeeds.map(
  ([code, name, description, category, unlocked], i) => ({
    id: i + 1,
    code,
    name,
    description,
    iconUrl: cover(name.slice(0, 2), 150 + i * 25),
    category,
    ruleType: 'count',
    ruleValue: (i + 1) * 5,
    sort: i + 1,
    unlocked,
    unlockedAt: unlocked ? daysAgo(30 - i * 3) : null,
    progress: unlocked ? null : (i + 1) * 11,
  }),
)

export const goals: GoalItem[] = [
  {
    id: 1,
    goalType: 'yearly',
    period: '2026',
    targetMinutes: 12000,
    targetBooks: 30,
    actualMinutes: 8620,
    actualBooks: 21,
    status: 'ongoing',
    minuteProgress: 72,
    bookProgress: 70,
    achieved: false,
  },
  {
    id: 2,
    goalType: 'monthly',
    period: '2026-10',
    targetMinutes: 900,
    targetBooks: 3,
    actualMinutes: 520,
    actualBooks: 2,
    status: 'ongoing',
    minuteProgress: 58,
    bookProgress: 67,
    achieved: false,
  },
]

const sessionSeeds = [
  { bookId: 1, days: 2, minutes: 118, from: 40, to: 96, note: '读完福贵被抓壮丁那一段。' },
  { bookId: 5, days: 6, minutes: 74, from: 120, to: 210, note: '第一次读三体，节奏很慢但很好。' },
  { bookId: 8, days: 7, minutes: 55, from: 20, to: 88, note: '' },
  { bookId: 10, days: 6, minutes: 93, from: 30, to: 120, note: '红楼梦读到葬花。' },
  { bookId: 17, days: 5, minutes: 41, from: 100, to: 160, note: '' },
  { bookId: 3, days: 5, minutes: 68, from: 12, to: 70, note: '' },
]

export const sessions: SessionSummary[] = sessionSeeds.map((s, i) => {
  const book = books[s.bookId - 1]
  return {
    sessionId: i + 1,
    bookId: book.id,
    bookTitle: book.title,
    coverUrl: book.coverUrl,
    startTime: daysAgo(s.days),
    endTime: daysAgo(s.days),
    durationSeconds: s.minutes * 60,
    startPage: s.from,
    endPage: s.to,
    note: s.note,
    status: 'finished',
  }
})

export const dailyDurations: DailyDuration[] = Array.from({ length: 30 }, (_, i) => ({
  date: new Date(now - (29 - i) * 86400000).toISOString().slice(0, 10),
  seconds: Math.max(0, Math.round(1800 + Math.sin(i / 2) * 1400 + (i % 4) * 420)),
  sessionCount: 1 + (i % 3),
}))

export const annualReview = {
  totalSeconds: 517200,
  sessionCount: 168,
  bookCount: 21,
  finishedBookCount: 14,
  longestStreak: 38,
  currentStreak: 12,
}
