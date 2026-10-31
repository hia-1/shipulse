/**
 * tabBar 消息角标（消息为第 3 个 tab，index=2）。
 * 启动、切前台、消息页操作后统一走这里，避免各页重复实现。
 */
const { request } = require('./request.js')
const store = require('./store.js')

const MESSAGE_TAB_INDEX = 2

function set(total) {
  const n = Number(total) || 0
  if (n > 0) {
    wx.setTabBarBadge({
      index: MESSAGE_TAB_INDEX,
      text: n > 99 ? '99+' : String(n),
      fail: () => {},
    })
  } else {
    clear()
  }
}

function clear() {
  wx.removeTabBarBadge({ index: MESSAGE_TAB_INDEX, fail: () => {} })
}

/** 拉取未读数并同步角标；未登录时清空 */
function refresh() {
  if (!store.getAccessToken()) {
    clear()
    return Promise.resolve(0)
  }
  return request('/notifications/unread-count')
    .then((res) => {
      const total = (res && res.total) || 0
      set(total)
      return total
    })
    .catch(() => 0)
}

module.exports = { set, clear, refresh }
