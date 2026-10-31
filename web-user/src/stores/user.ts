import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { register as apiRegister, login as apiLogin, getProfile, type UserInfo } from '@/api/auth'
import { setTokens, clearTokens, getAccessToken } from '@/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<UserInfo | null>(null)
  const loading = ref(false)

  const isLoggedIn = computed(() => !!getAccessToken())
  const nickname = computed(() => user.value?.nickname || '')

  async function register(data: { phone: string; code: string; nickname?: string }) {
    loading.value = true
    try {
      const res = await apiRegister(data)
      const { accessToken, refreshToken, user: userInfo } = res.data
      setTokens(accessToken, refreshToken)
      user.value = userInfo
      return userInfo
    } finally {
      loading.value = false
    }
  }

  async function login(data: { phone: string; code: string }) {
    loading.value = true
    try {
      const res = await apiLogin(data)
      const { accessToken, refreshToken, user: userInfo } = res.data
      setTokens(accessToken, refreshToken)
      user.value = userInfo
      return userInfo
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile() {
    if (!isLoggedIn.value) return null
    const res = await getProfile()
    user.value = res.data
    return res.data
  }

  function logout() {
    user.value = null
    clearTokens()
  }

  // 从 localStorage 恢复登录态（页面刷新时调用）
  function restore() {
    if (isLoggedIn.value && !user.value) {
      return fetchProfile().catch(() => {
        // 拦截器仅在鉴权真正失效时清空令牌；网络抖动不应误注销
        if (!getAccessToken()) logout()
      })
    }
    return Promise.resolve()
  }

  return { user, loading, isLoggedIn, nickname, register, login, fetchProfile, logout, restore }
})
