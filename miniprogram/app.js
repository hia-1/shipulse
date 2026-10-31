const store = require('./utils/store.js')
const auth = require('./utils/auth.js')
const badge = require('./utils/badge.js')

App({
  globalData: {
    userInfo: null,
  },
  onLaunch() {
    this.globalData.userInfo = store.getUser()
    // 已有本地登录态：静默刷新资料，保证昵称 / 会员状态最新（失败不打扰用户）
    if (store.getAccessToken()) {
      auth
        .fetchProfile()
        .then((user) => {
          this.globalData.userInfo = user
        })
        .catch(() => {})
    }
    this.checkUpdate()
    this.watchNetwork()
  },
  onShow() {
    // 启动与回到前台时同步消息角标（tabBar 渲染完成后再设置）
    setTimeout(() => badge.refresh(), 600)
  },
  /** 小程序新版本：下载完成后提示重启 */
  checkUpdate() {
    if (!wx.getUpdateManager) return
    const manager = wx.getUpdateManager()
    manager.onUpdateReady(() => {
      wx.showModal({
        title: '发现新版本',
        content: '新版本已准备好，是否立即重启应用？',
        confirmText: '立即重启',
        success: (r) => {
          if (r.confirm) manager.applyUpdate()
        },
      })
    })
  },
  /** 断网时提示一次，恢复后由页面下拉刷新重试 */
  watchNetwork() {
    if (!wx.onNetworkStatusChange) return
    wx.onNetworkStatusChange((res) => {
      if (!res.isConnected) {
        wx.showToast({ title: '网络已断开', icon: 'none' })
      }
    })
  },
})
