/**
 * 本地登录态存储（纯读写，不依赖网络，供 request 与 auth 共用避免循环依赖）
 */
const TOKEN_KEY = 'sp_tokens'
const USER_KEY = 'sp_user'

function getTokens() {
  return wx.getStorageSync(TOKEN_KEY) || null
}

function setTokens(tokens) {
  if (tokens && tokens.accessToken && tokens.refreshToken) {
    wx.setStorageSync(TOKEN_KEY, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  }
}

function getAccessToken() {
  const t = getTokens()
  return (t && t.accessToken) || ''
}

function getRefreshToken() {
  const t = getTokens()
  return (t && t.refreshToken) || ''
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function setUser(user) {
  if (user) {
    wx.setStorageSync(USER_KEY, user)
  }
}

function clear() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

module.exports = {
  getTokens,
  setTokens,
  getAccessToken,
  getRefreshToken,
  getUser,
  setUser,
  clear,
}
