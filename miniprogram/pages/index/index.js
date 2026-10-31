const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const store = require('../../utils/store.js')

const app = getApp()

function withAvatar(user) {
  if (!user) return null
  const name = (user.nickname || '书友').trim()
  return Object.assign({}, user, { avatarText: name.slice(-2) })
}

Page({
  data: {
    user: null,
    keyword: '',
    todayMinutes: 0,
    checkedToday: false,
    readingBooks: [],
    loading: true,
    checking: false,
    logging: false,
    error: '',
  },

  onShow() {
    this.setData({ user: withAvatar(store.getUser()) })
    this.loadData()
  },

  onPullDownRefresh() {
    this.loadData().then(() => wx.stopPullDownRefresh())
  },

  loadData() {
    this.setData({ loading: true, error: '' })
    const logged = auth.isLoggedIn()
    const todayTask = logged
      ? request('/posts/today').catch(() => null)
      : Promise.resolve(null)
    const shelfTask = logged
      ? request('/bookshelf', { data: { status: 'reading', pageSize: 5 } }).catch(() => null)
      : Promise.resolve(null)

    return Promise.all([todayTask, shelfTask])
      .then(([today, shelf]) => {
        this.setData({
          todayMinutes: today ? today.todayMinutes || 0 : 0,
          checkedToday: !!(today && today.checkedToday),
          readingBooks: this.decorate((shelf && shelf.list) || []),
          loading: false,
        })
      })
      .catch((e) => {
        this.setData({ loading: false, error: (e && e.message) || '加载失败' })
      })
  },

  decorate(list) {
    return list.map((it) => {
      const pages = (it.book && it.book.pages) || 0
      const raw =
        it.progress != null && it.progress !== ''
          ? Number(it.progress)
          : pages
            ? (Number(it.currentPage) / pages) * 100
            : 0
      const value = Math.min(100, Math.max(0, Math.round(raw || 0)))
      const title = (it.book && it.book.title) || ''
      return Object.assign({}, it, {
        progressValue: value,
        coverText: title.slice(0, 4),
      })
    })
  },

  onCoverError(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`readingBooks[${index}].coverFailed`]: true })
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearchConfirm() {
    const kw = (this.data.keyword || '').trim()
    wx.navigateTo({
      url: `/pages/search/search?keyword=${encodeURIComponent(kw)}`,
    })
  },

  goSearch() {
    wx.navigateTo({ url: '/pages/search/search' })
  },

  goPulse() {
    wx.switchTab({ url: '/pages/pulse/pulse' })
  },

  goBook(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/book/book?id=${id}` })
  },

  onQuickCheckin() {
    if (!auth.isLoggedIn()) {
      this.toast('请先登录')
      return
    }
    if (this.data.checkedToday) {
      this.toast('今日已打卡，继续保持')
      return
    }
    const books = this.data.readingBooks
    if (!books.length) {
      this.toast('请先在书架标记一本「在读」的书')
      this.goSearch()
      return
    }
    if (books.length === 1) {
      this.askMinutes(books[0])
      return
    }
    // 多本在读：先选书再填时长
    wx.showActionSheet({
      itemList: books.slice(0, 6).map((b) => (b.book && b.book.title) || '未命名'),
      success: (r) => this.askMinutes(books[r.tapIndex]),
    })
  },

  askMinutes(book) {
    wx.showModal({
      title: '快捷打卡',
      editable: true,
      placeholderText: '本次阅读时长（分钟）',
      content: '15',
      success: (r) => {
        if (!r.confirm) return
        const minutes = parseInt(r.content, 10)
        if (!Number.isFinite(minutes) || minutes <= 0) {
          this.toast('请输入有效的阅读分钟数')
          return
        }
        this.submitCheckin(book.bookId, minutes)
      },
    })
  },

  submitCheckin(bookId, readMinutes) {
    if (this.data.checking) return
    this.setData({ checking: true })
    request('/posts/checkin', { method: 'POST', data: { bookId, readMinutes } })
      .then(() => {
        wx.showToast({ title: '打卡成功', icon: 'success' })
        this.loadData()
      })
      .catch((e) => this.toast((e && e.message) || '打卡失败'))
      .then(() => this.setData({ checking: false }))
  },

  onGetPhoneNumber(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      this.toast('已取消授权，可稍后再登录')
      return
    }
    if (this.data.logging) return
    this.setData({ logging: true })
    wx.showLoading({ title: '登录中', mask: true })
    auth
      .wechatLoginWithPhone(code)
      .then((user) => {
        wx.hideLoading()
        app.globalData.userInfo = user
        this.setData({ user, logging: false })
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.loadData()
      })
      .catch((err) => {
        wx.hideLoading()
        this.setData({ logging: false })
        this.toast((err && err.message) || '登录失败')
      })
  },

  onSilentLogin() {
    if (this.data.logging) return
    this.setData({ logging: true })
    auth
      .silentWechatLogin()
      .then((user) => {
        app.globalData.userInfo = user
        this.setData({ user, logging: false })
        this.loadData()
      })
      .catch((err) => {
        this.setData({ logging: false })
        this.toast((err && err.message) || '登录失败')
      })
  },

  onShareAppMessage() {
    return {
      title: '时脉书社 · 记录每一次阅读的脉动',
      path: '/pages/index/index',
    }
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (r) => {
        if (!r.confirm) return
        auth.logout().then(() => {
          app.globalData.userInfo = null
          this.setData({
            user: null,
            readingBooks: [],
            checkedToday: false,
            todayMinutes: 0,
          })
          this.toast('已退出')
        })
      },
    })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
