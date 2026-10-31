import axios from 'axios'
import { ElMessage } from 'element-plus'
import { DEMO_ADMIN_REFRESH, DEMO_ADMIN_TOKEN, installDemo } from './demo'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 为 true 时该请求失败不弹出全局错误提示，由调用方自行处理 */
    skipErrorToast?: boolean
  }
}

/**
 * 管理端统一 API 客户端：开发环境经 vite proxy 转发 /api 到后端 3000 端口
 */
export const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

const ACCESS_TOKEN_KEY = 'shipulse_admin_access_token'
const REFRESH_TOKEN_KEY = 'shipulse_admin_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || ''
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || ''
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// 请求拦截器：注入 Bearer Token
http.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：后端统一返回 { code, message, data }，提取 data 字段
// 业务错误与网络错误统一在此弹出提示（skipErrorToast 可关闭）
http.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        response.data = body.data
        return response
      }
      const msg = body.message || '请求失败'
      if (!response.config?.skipErrorToast) ElMessage.error(msg)
      return Promise.reject(new Error(msg))
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || ''
    // 登录/刷新等认证端点自身的 401 属于业务结果，不做令牌续期与跳转
    const isAuthEndpoint =
      url.includes('/admin/login') ||
      url.includes('/auth/login') ||
      url.includes('/auth/refresh')
    if (
      error.response?.status === 401 &&
      !isAuthEndpoint &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(new Error('请先登录'))
      }
      try {
        const res = await axios.post('/api/auth/refresh', { refreshToken })
        const body = res.data
        if (body?.code !== 0) throw new Error(body?.message || '刷新失败')
        const { accessToken, refreshToken: newRefresh } = body.data
        setTokens(accessToken, newRefresh)
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return http(originalRequest)
      } catch {
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(new Error('登录已过期，请重新登录'))
      }
    }
    const msg = error.response?.data?.message || error.message || '网络错误'
    if (!originalRequest?.skipErrorToast) ElMessage.error(msg)
    return Promise.reject(new Error(msg))
  },
)

// 演示模式（GitHub Pages 静态预览）：不请求后端，全部由内置演示数据应答
if (import.meta.env.VITE_DEMO === '1') {
  http.defaults.adapter = installDemo()
  if (!getAccessToken()) {
    setTokens(DEMO_ADMIN_TOKEN, DEMO_ADMIN_REFRESH)
    localStorage.setItem('shipulse_admin_roles', JSON.stringify(['super_admin']))
  }
}