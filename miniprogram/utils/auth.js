const { request } = require('./request.js')
const store = require('./store.js')

/** 保存登录结果（令牌 + 用户），返回用户 */
function applyAuth(result) {
  store.setTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
  })
  store.setUser(result.user)
  return result.user
}

/** 微信小程序一键登录（code + 可选手机号凭证） */
function wechatLogin(payload) {
  return request('/auth/wechat', {
    method: 'POST',
    data: payload,
    auth: false,
  }).then(applyAuth)
}

/** 手机号验证码登录（与 Web 端同账号体系） */
function loginWithPhone(phone, code) {
  return request('/auth/login', {
    method: 'POST',
    data: { phone, code },
    auth: false,
  }).then(applyAuth)
}

/** 拉取并缓存当前用户资料 */
function fetchProfile() {
  return request('/user/profile').then((user) => {
    store.setUser(user)
    return user
  })
}

/** 退出登录：服务端失效令牌 + 清空本地登录态 */
function logout() {
  const clearLocal = () => store.clear()
  return request('/auth/logout', { method: 'POST' })
    .then(clearLocal)
    .catch(clearLocal)
}

function isLoggedIn() {
  return !!store.getAccessToken()
}

function getUser() {
  return store.getUser()
}

/** wx.login 换 code */
function wxLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: (res) => {
        if (res && res.code) resolve(res.code)
        else reject(new Error('微信登录失败，请重试'))
      },
      fail: () => reject(new Error('微信登录失败，请重试')),
    })
  })
}

/**
 * 静默微信登录：仅用 wx.login 的 code（不绑定手机号）。
 * 用于已有账号再次进入小程序时的无感登录。
 */
function silentWechatLogin() {
  return wxLogin().then((code) => wechatLogin({ code }))
}

/**
 * 微信一键登录 + 手机号绑定：code + getPhoneNumber 的 phoneCode。
 * 后端以手机号为统一标识，命中已有 Web 账号即合并为同一用户。
 */
function wechatLoginWithPhone(phoneCode, profile) {
  return wxLogin().then((code) =>
    wechatLogin(Object.assign({ code, phoneCode }, profile || {})),
  )
}

module.exports = {
  wechatLogin,
  loginWithPhone,
  fetchProfile,
  logout,
  isLoggedIn,
  getUser,
  silentWechatLogin,
  wechatLoginWithPhone,
}
