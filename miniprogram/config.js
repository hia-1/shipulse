/**
 * 小程序基础配置。
 * - API_BASE：后端地址（小程序要求 https 合法域名，正式环境在微信公众平台配置；
 *   开发阶段可在开发者工具勾选「不校验合法域名」并联调本机后端）
 * - WEB_BASE：Web 用户站地址，用于「去 Web 站」引流
 */
module.exports = {
  API_BASE: 'http://localhost:3000/api',
  WEB_BASE: 'http://localhost:5173',
  APP_NAME: '时脉书社',
}
