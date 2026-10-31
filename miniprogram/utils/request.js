const { API_BASE } = require('../config.js')
const store = require('./store.js')

const TIMEOUT = 15000
/** 并发 401 时只发起一次刷新，其余请求复用同一 Promise */
let refreshing = null

/** 裸请求：不做鉴权与解包，返回完整响应，便于统一处理状态码 */
function raw(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: TIMEOUT,
      header: Object.assign({ 'Content-Type': 'application/json' }, options.header || {}),
      success: (res) => resolve(res),
      fail: () =>
        reject({
          statusCode: 0,
          message: '网络连接失败，请检查网络后重试',
        }),
    })
  })
}

/** 统一错误对象：携带 HTTP 状态码与后端文案 */
function toError(res, body) {
  const status = res.statusCode || 0
  const message =
    (body && body.message) ||
    (status >= 500 ? '服务暂时不可用，请稍后重试' : '请求失败，请稍后重试')
  const err = new Error(message)
  err.statusCode = status
  err.body = body || null
  return err
}

function doRefresh() {
  const refreshToken = store.getRefreshToken()
  if (!refreshToken) return Promise.reject(new Error('无刷新令牌'))
  if (!refreshing) {
    refreshing = raw('/auth/refresh', {
      method: 'POST',
      data: { refreshToken },
    })
      .then((res) => {
        if (
          res.statusCode >= 200 &&
          res.statusCode < 300 &&
          res.data &&
          res.data.code === 0
        ) {
          store.setTokens(res.data.data)
          return res.data.data
        }
        throw new Error('refresh failed')
      })
      .catch((e) => {
        refreshing = null
        throw e
      })
    refreshing.then(
      () => {
        refreshing = null
      },
      () => {},
    )
  }
  return refreshing
}

/**
 * 统一请求：
 * - 自动附带 Bearer Token
 * - 后端信封 { code, message, data }，成功返回 data
 * - 401 自动尝试刷新令牌并重放一次；失败则清空登录态并抛出
 * options: { method, data, header, auth=true, retry=true }
 */
function request(path, options = {}) {
  const opts = Object.assign({ method: 'GET', auth: true, retry: true }, options)
  const header = Object.assign({ 'Content-Type': 'application/json' }, opts.header || {})
  if (opts.auth) {
    const token = store.getAccessToken()
    if (token) header.Authorization = `Bearer ${token}`
  }

  return raw(path, { method: opts.method, data: opts.data, header }).then((res) => {
    const body = res.data

    if (res.statusCode === 401 && opts.auth && opts.retry) {
      return doRefresh()
        .then(() => request(path, Object.assign({}, opts, { retry: false })))
        .catch(() => {
          store.clear()
          throw toError(res, body)
        })
    }

    if (res.statusCode >= 200 && res.statusCode < 300 && body && body.code === 0) {
      return body.data
    }
    throw toError(res, body)
  })
}

module.exports = { request, raw }
