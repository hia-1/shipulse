const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const { WEB_BASE } = require('../../config.js')
const { formatRating, relativeTime } = require('../../utils/format.js')

const STATUS_LABEL = { want: '想读', reading: '在读', read: '已读' }

Page({
  data: {
    bookId: null,
    book: null,
    ratingText: '暂无',
    shelfStatus: null,
    shelfLabel: '',
    loading: true,
    error: '',
    coverFailed: false,
    reviews: [],
    reviewTotal: 0,
    reviewLoading: false,
    reviewError: '',
    webUrl: '',
    shelfOptions: [
      { value: 'want', label: '想读' },
      { value: 'reading', label: '在读' },
      { value: 'read', label: '已读' },
    ],
  },

  onLoad(options) {
    const id = options && options.id
    if (!id) {
      this.setData({ loading: false, error: '缺少书籍参数' })
      return
    }
    this.setData({ bookId: id, webUrl: `${WEB_BASE}/books/${id}` })
    this.loadBook()
    this.loadShelf()
    this.loadReviews()
  },

  onShow() {
    if (this.data.bookId) this.loadShelf()
  },

  loadBook() {
    this.setData({ loading: true, error: '' })
    request(`/library/books/${this.data.bookId}`, { auth: false })
      .then((book) =>
        this.setData({
          book,
          ratingText: formatRating(book.ratingAvg),
          loading: false,
        }),
      )
      .catch((e) =>
        this.setData({ loading: false, error: (e && e.message) || '加载失败' }),
      )
  },

  loadShelf() {
    if (!auth.isLoggedIn()) {
      this.setData({ shelfStatus: null, shelfLabel: '' })
      return
    }
    request(`/bookshelf/status/${this.data.bookId}`)
      .then((res) => {
        const status = res ? res.status : null
        this.setData({
          shelfStatus: status,
          shelfLabel: status ? STATUS_LABEL[status] : '',
        })
      })
      .catch(() => {})
  },

  /** 书评列表（公开接口，取热门 5 条） */
  loadReviews() {
    this.setData({ reviewLoading: true, reviewError: '' })
    return request('/community/reviews', {
      data: {
        bookId: this.data.bookId,
        sort: 'hot',
        page: 1,
        pageSize: 5,
      },
      auth: false,
    })
      .then((res) => {
        const list = ((res && res.list) || []).map((r) => {
          const author = r.author || {}
          const nickname = author.nickname || '书友'
          return Object.assign({}, r, {
            ratingText: formatRating(r.rating),
            timeText: relativeTime(r.publishedAt || r.createdAt),
            authorName: nickname,
            avatarUrl: author.avatarUrl || '',
            avatarText: nickname.slice(-2),
            isMember: !!author.isMember,
          })
        })
        this.setData({
          reviews: list,
          reviewTotal: (res && res.total) || list.length,
          reviewLoading: false,
        })
      })
      .catch((e) => {
        this.setData({
          reviewLoading: false,
          reviewError: (e && e.message) || '书评加载失败',
        })
      })
  },

  onLikeReview(e) {
    if (!auth.isLoggedIn()) {
      this.promptLogin()
      return
    }
    if (this.liking) return
    const ds = e.currentTarget.dataset
    this.liking = true
    request(`/community/reviews/${ds.id}/like`, { method: 'POST' })
      .then((res) => {
        const list = this.data.reviews.slice()
        const item = list[ds.index]
        if (item) {
          list[ds.index] = Object.assign({}, item, {
            likeCount: res.likeCount,
            isLiked: res.isLiked,
          })
        }
        this.setData({ reviews: list })
        this.toast(res.isLiked ? '已点赞' : '已取消点赞')
      })
      .catch((err) => this.toast((err && err.message) || '操作失败'))
      .then(() => {
        this.liking = false
      })
  },

  goWriteReview() {
    this.guideWeb('已复制链接，可在 Web 站写书评或查看全部书评')
  },

  onCoverError() {
    this.setData({ coverFailed: true })
  },

  onRetry() {
    this.loadBook()
    this.loadReviews()
    this.loadShelf()
  },

  onSetShelf(e) {
    if (!auth.isLoggedIn()) {
      this.promptLogin()
      return
    }
    const status = e.currentTarget.dataset.status
    if (status === this.data.shelfStatus) {
      this.removeShelf()
      return
    }
    request(`/bookshelf/${this.data.bookId}`, {
      method: 'PUT',
      data: { status },
    })
      .then(() => {
        this.setData({ shelfStatus: status, shelfLabel: STATUS_LABEL[status] })
        this.toast(`已标记为「${STATUS_LABEL[status]}」`)
      })
      .catch((err) => this.toast((err && err.message) || '操作失败'))
  },

  removeShelf() {
    wx.showModal({
      title: '移出书架',
      content: '确定将这本书移出书架吗？',
      success: (r) => {
        if (!r.confirm) return
        request(`/bookshelf/${this.data.bookId}`, { method: 'DELETE' })
          .then(() => {
            this.setData({ shelfStatus: null, shelfLabel: '' })
            this.toast('已移出书架')
          })
          .catch((err) => this.toast((err && err.message) || '操作失败'))
      },
    })
  },

  onStartReading() {
    if (!auth.isLoggedIn()) {
      this.promptLogin()
      return
    }
    const b = this.data.book || {}
    wx.navigateTo({
      url:
        `/pages/reading/reading?id=${this.data.bookId}` +
        `&title=${encodeURIComponent(b.title || '')}` +
        `&cover=${encodeURIComponent(b.coverUrl || '')}`,
    })
  },

  onShareAppMessage() {
    const b = this.data.book || {}
    return {
      title: b.title ? `《${b.title}》· 时脉书社` : '时脉书社',
      path: `/pages/book/book?id=${this.data.bookId}`,
      imageUrl: this.data.coverFailed ? '' : b.coverUrl || '',
    }
  },

  onGoWeb() {
    this.guideWeb('已复制 Web 站链接，请在浏览器中打开体验完整功能')
  },

  guideWeb(message) {
    wx.setClipboardData({
      data: this.data.webUrl,
      success: () => {
        wx.showModal({
          title: '前往 Web 站',
          content: `${message}\n${this.data.webUrl}`,
          showCancel: false,
          confirmText: '知道了',
        })
      },
      fail: () =>
        wx.showModal({
          title: '前往 Web 站',
          content: `请在浏览器中打开：\n${this.data.webUrl}`,
          showCancel: false,
        }),
    })
  },

  promptLogin() {
    wx.showModal({
      title: '需要登录',
      content: '登录后即可加入书架、同步阅读记录',
      confirmText: '去登录',
      success: (r) => {
        if (r.confirm) wx.switchTab({ url: '/pages/index/index' })
      },
    })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
