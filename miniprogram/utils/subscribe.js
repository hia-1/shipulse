const { request } = require('./request.js')

/**
 * 请求订阅消息授权。
 * 必须在用户点击事件的同步调用链中触发（微信要求），因此由按钮 tap 直接调用。
 * 返回 { accepted, rejected }：accepted 为本次同意授权的模板ID。
 */
function requestSubscribe(templateIds) {
  const ids = (templateIds || []).slice(0, 3) // 微信单次最多 3 个模板
  return new Promise((resolve, reject) => {
    if (!ids.length) {
      resolve({ accepted: [], rejected: [] })
      return
    }
    if (!wx.requestSubscribeMessage) {
      reject(new Error('当前微信版本不支持订阅消息'))
      return
    }
    wx.requestSubscribeMessage({
      tmplIds: ids,
      success: (res) => {
        const accepted = []
        const rejected = []
        ids.forEach((id) => {
          if (res[id] === 'accept') accepted.push(id)
          else rejected.push(id)
        })
        resolve({ accepted, rejected })
      },
      fail: (err) =>
        reject(new Error((err && err.errMsg) || '订阅授权失败')),
    })
  })
}

/** 上报授权结果，累加后端可下发额度 */
function reportAuthorize(templateIds) {
  return request('/subscribe/authorize', {
    method: 'POST',
    data: { templateIds },
  })
}

/** 查询订阅授权状态（模板清单 + 我的授权额度） */
function getStatus() {
  return request('/subscribe/status')
}

/** 可用模板（公开接口，未登录也可获取） */
function getTemplates() {
  return request('/subscribe/templates', { auth: false })
}

module.exports = { requestSubscribe, reportAuthorize, getStatus, getTemplates }
