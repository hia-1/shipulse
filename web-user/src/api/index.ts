import axios from 'axios'
import { showToast } from '@/composables/useToast'
import { DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN, installDemo } from './demo'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 为 true 时该请求失败不弹出全局错误提示，由调用方自行处理 */
    skipErrorToast?: boolean
  }
}

/**
 * 统一 API 客户端：开发环境经 vite proxy 转发 /api 到后端 3000 端口
 */
export const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

const ACCESS_TOKEN_KEY = 'shipulse_access_token'
const REFRESH_TOKEN_KEY = 'shipulse_refresh_token'

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
      if (!response.config?.skipErrorToast) showToast(msg, 'error')
      return Promise.reject(new Error(msg))
    }
    return response
  },
  async (error) => {
    const originalRequest = error.config
    const url = originalRequest?.url || ''
    // 登录/注册/刷新等认证端点自身的 401 属于业务结果，不做令牌续期与跳转
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh')
    // 401 且非认证端点、未重试过 → 尝试刷新令牌
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
    if (!originalRequest?.skipErrorToast) showToast(msg, 'error')
    return Promise.reject(new Error(msg))
  },
)

export async function fetchHealth() {
  const res = await axios.get('/health', { baseURL: '' })
  return res.data
}

// 演示模式（GitHub Pages 静态预览）：不请求后端，全部由内置演示数据应答
if (import.meta.env.VITE_DEMO === '1') {
  http.defaults.adapter = installDemo()
  if (!getAccessToken()) {
    setTokens(DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN)
  }
}
