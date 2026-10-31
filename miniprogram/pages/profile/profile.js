const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const store = require('../../utils/store.js')
const { WEB_BASE, APP_NAME } = require('../../config.js')

function pad(n) {
  return `${n}`.padStart(2, '0')
}

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function withAvatar(user) {
  if (!user) return null
  const name = (user.nickname || '书友').trim()
  return Object.assign({}, user, { avatarText: name.slice(-2) })
}

Page({
  data: {
    user: null,
    needLogin: false,
    loading: true,
    error: '',
    shelf: { want: 0, reading: 0, read: 0 },
    badges: [],
    badgeCount: 0,
    member: { isMember: false, planName: '', expireText: '' },
    webBase: WEB_BASE,
    appName: APP_NAME,
    version: '1.0.0',
    loggingOut: false,
  },

  onShow() {
    this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    this.setData({ user: withAvatar(store.getUser()) })
    if (!auth.isLoggedIn()) {
      this.setData({ needLogin: true, loading: false })
      return Promise.resolve()
    }
    this.setData({ needLogin: false, loading: true, error: '' })
    const shelfCount = (status) =>
      request('/bookshelf', { data: { status, pageSize: 1 } }).catch(() => null)

    return Promise.all([
      request('/user/profile').catch(() => null),
      shelfCount('want'),
      shelfCount('reading'),
      shelfCount('read'),
      request('/incentive/badges/mine').catch(() => []),
      request('/membership/my').catch(() => null),
    ])
      .then(([profile, want, reading, read, badges, member]) => {
        if (profile) store.setUser(profile)
        const list = Array.isArray(badges) ? badges : []
        this.setData({
          user: withAvatar(profile || store.getUser()),
          shelf: {
            want: (want && want.total) || 0,
            reading: (reading && reading.total) || 0,
            read: (read && read.total) || 0,
          },
          badges: list.slice(0, 6),
          badgeCount: list.length,
          member: {
            isMember: !!(member && member.isMember),
            planName:
              (member && member.subscription && member.subscription.planName) || '',
            expireText:
              member && member.memberExpireAt ? formatDate(member.memberExpireAt) : '',
          },
          loading: false,
        })
      })
      .catch((e) =>
        this.setData({ loading: false, error: (e && e.message) || '加载失败' }),
      )
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (r) => {
        if (!r.confirm) return
        this.setData({ loggingOut: true })
        auth
          .logout()
          .then(() => {
            const app = getApp()
            if (app) app.globalData.userInfo = null
            this.setData({
              user: null,
              needLogin: true,
              loggingOut: false,
              shelf: { want: 0, reading: 0, read: 0 },
              badges: [],
              badgeCount: 0,
              member: { isMember: false, planName: '', expireText: '' },
            })
            this.toast('已退出')
          })
          .catch(() => this.setData({ loggingOut: false }))
      },
    })
  },

  /** 清除本地缓存（保留登录态，避免误退出） */
  onClearCache() {
    const tokens = store.getTokens()
    const user = store.getUser()
    wx.clearStorageSync()
    if (tokens) store.setTokens(tokens)
    if (user) store.setUser(user)
    this.toast('缓存已清除')
  },

  /** 复制 Web 站链接并在浏览器中打开（协议/反馈/帮助/会员等完整功能在 Web 端） */
  onGoWeb(e) {
    const path = e.currentTarget.dataset.path || '/'
    const url = `${WEB_BASE}${path}`
    wx.setClipboardData({
      data: url,
      success: () =>
        wx.showModal({
          title: '前往 Web 站',
          content: `已复制链接，请在浏览器中打开：\n${url}`,
          showCancel: false,
          confirmText: '知道了',
        }),
      fail: () =>
        wx.showModal({
          title: '前往 Web 站',
          content: `请在浏览器中打开：\n${url}`,
          showCancel: false,
        }),
    })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
