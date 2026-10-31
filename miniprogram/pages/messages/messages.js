const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const subscribe = require('../../utils/subscribe.js')
const badge = require('../../utils/badge.js')
const { relativeTime } = require('../../utils/format.js')

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'like', label: '赞' },
  { key: 'comment', label: '评论' },
  { key: 'system', label: '系统' },
]

Page({
  data: {
    needLogin: false,
    tabs: TABS,
    activeTab: 'all',
    unread: { total: 0, like: 0, comment: 0, system: 0 },
    list: [],
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    marking: false,
    templates: [],
    hasAuthorized: false,
    subscribeMock: true,
    subscribing: false,
    error: '',
  },

  onLoad() {
    this.reload()
  },

  onShow() {
    if (!this.data.loading) this.reload()
  },

  onPullDownRefresh() {
    this.reload().then(() => wx.stopPullDownRefresh())
  },

  onReachBottom() {
    this.loadMore()
  },

  reload() {
    if (!auth.isLoggedIn()) {
      this.setData({ needLogin: true, loading: false })
      badge.clear()
      return Promise.resolve()
    }
    this.setData({ needLogin: false, loading: true, error: '' })
    return Promise.all([
      request('/notifications/unread-count').catch(() => ({
        total: 0,
        like: 0,
        comment: 0,
        system: 0,
      })),
      this.fetchList(1),
      request('/subscribe/status').catch(() => null),
    ])
      .then(([unread, pageData, sub]) => {
        const templates = (sub && sub.templates) || []
        this.setData({
          unread: unread || { total: 0, like: 0, comment: 0, system: 0 },
          list: pageData.list,
          page: 1,
          total: pageData.total,
          hasMore: pageData.list.length < pageData.total,
          templates,
          hasAuthorized: templates.some((t) => t.authorized),
          subscribeMock: sub ? !!sub.mock : true,
          loading: false,
        })
        this.syncBadge(unread)
      })
      .catch((e) =>
        this.setData({ loading: false, error: (e && e.message) || '加载失败' }),
      )
  },

  fetchList(page) {
    const type = this.data.activeTab
    return request(
      `/notifications?type=${type}&page=${page}&pageSize=${this.data.pageSize}`,
    ).then((res) => ({
      list: ((res && res.list) || []).map((n) =>
        Object.assign({}, n, { timeText: relativeTime(n.createdAt) }),
      ),
      total: (res && res.total) || 0,
    }))
  },

  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.setData({ loadingMore: true })
    const next = this.data.page + 1
    this.fetchList(next)
      .then((pageData) => {
        const list = this.data.list.concat(pageData.list)
        this.setData({
          list,
          page: next,
          total: pageData.total,
          hasMore: list.length < pageData.total,
          loadingMore: false,
        })
      })
      .catch((e) => {
        this.setData({ loadingMore: false })
        this.toast((e && e.message) || '加载失败')
      })
  },

  onSwitchTab(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key, loading: true, error: '' })
    this.fetchList(1)
      .then((pageData) =>
        this.setData({
          list: pageData.list,
          page: 1,
          total: pageData.total,
          hasMore: pageData.list.length < pageData.total,
          loading: false,
        }),
      )
      .catch((e) =>
        this.setData({ loading: false, error: (e && e.message) || '加载失败' }),
      )
  },

  onTapItem(e) {
    const ds = e.currentTarget.dataset
    const item = this.data.list[ds.index]
    if (!item) return
    // 先跳转，保证已读消息仍可再次查看关联内容
    this.openTarget(item)
    if (item.isRead) return
    request(`/notifications/${ds.id}/read`, { method: 'PATCH' })
      .then(() => {
        const list = this.data.list.slice()
        list[ds.index] = Object.assign({}, item, { isRead: true })
        const unread = Object.assign({}, this.data.unread)
        unread.total = Math.max(0, (unread.total || 0) - 1)
        if (unread[item.category] > 0) unread[item.category] -= 1
        this.setData({ list, unread })
        this.syncBadge(unread)
      })
      .catch(() => {})
  },

  /** 按消息关联对象跳转：书籍直达详情，书评/评论先查所属书籍 */
  openTarget(item) {
    const targetId = Number(item.targetId)
    if (!targetId) return
    if (item.targetType === 'book') {
      wx.navigateTo({ url: `/pages/book/book?id=${targetId}` })
      return
    }
    if (item.targetType === 'review') {
      request(`/community/reviews/${targetId}`, { auth: false })
        .then((review) => {
          if (review && review.bookId) {
            wx.navigateTo({ url: `/pages/book/book?id=${review.bookId}` })
          }
        })
        .catch(() => {})
    }
  },

  onMarkAllRead() {
    if (this.data.marking) return
    if (!this.data.unread.total) {
      this.toast('暂无未读消息')
      return
    }
    this.setData({ marking: true })
    request(`/notifications/read-all?type=${this.data.activeTab}`, {
      method: 'PATCH',
    })
      .then(() => {
        this.toast('已全部标记为已读')
        return this.reload()
      })
      .catch((e) => this.toast((e && e.message) || '操作失败'))
      .then(() => this.setData({ marking: false }))
  },

  /** 订阅消息授权（必须在用户点击链中调用 wx.requestSubscribeMessage） */
  onSubscribe() {
    const ids = this.data.templates.map((t) => t.id)
    if (!ids.length) {
      this.toast('暂无可订阅的提醒')
      return
    }
    if (this.data.subscribing) return
    this.setData({ subscribing: true })
    subscribe
      .requestSubscribe(ids)
      .then((res) => {
        if (!res.accepted.length) {
          this.toast('未授权，可稍后再开启')
          return null
        }
        return subscribe.reportAuthorize(res.accepted).then(() => {
          this.toast('已开启阅读提醒')
          return this.reload()
        })
      })
      .catch((e) => this.toast((e && e.message) || '授权失败'))
      .then(() => this.setData({ subscribing: false }))
  },

  /** 同步 tabBar 消息角标 */
  syncBadge(unread) {
    badge.set(unread && unread.total)
  },

  clearBadge() {
    badge.clear()
  },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
