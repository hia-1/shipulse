import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, getProfile, type AdminInfo } from '@/api/admin'
import { setTokens, clearTokens, getAccessToken } from '@/api'
import { hasPermission as matchHasPermission } from '@/permission'

const ROLES_KEY = 'shipulse_admin_roles'

function readStoredRoles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ROLES_KEY) || '[]')
  } catch {
    return []
  }
}

/**
 * 管理端登录态 store
 * roles 默认来自登录响应；后端 profile 返回角色前，dev 下默认给超级管理员，
 * 以便权限框架可演示（页面可按角色切换验证不同权限）。
 */
export const useAdminStore = defineStore('admin', () => {
  const admin = ref<AdminInfo | null>(null)
  const roles = ref<string[]>(readStoredRoles())
  const loading = ref(false)

  const isLoggedIn = computed(() => !!getAccessToken() && admin.value !== null)

  function persistRoles() {
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles.value))
  }

  async function login(data: { username: string; password: string }) {
    loading.value = true
    try {
      const res = await apiLogin(data)
      const { accessToken, refreshToken, admin: adminInfo } = res.data
      setTokens(accessToken, refreshToken)
      admin.value = adminInfo
      // 优先使用后端返回的角色；后端未返回时兜底授予超管便于本地演示
      roles.value = adminInfo.roles?.length ? adminInfo.roles : ['super_admin']
      persistRoles()
      return adminInfo
    } finally {
      loading.value = false
    }
  }

  async function fetchProfile() {
    if (!getAccessToken()) return null
    const res = await getProfile()
    admin.value = res.data
    if (res.data.roles?.length) setRoles(res.data.roles)
    return res.data
  }

  function setRoles(codes: string[]) {
    roles.value = codes
    persistRoles()
  }

  /** 是否拥有某权限点 */
  function hasPermission(required: string): boolean {
    return matchHasPermission(roles.value, required)
  }

  function logout() {
    admin.value = null
    roles.value = []
    clearTokens()
    localStorage.removeItem(ROLES_KEY)
  }

  async function restore() {
    if (getAccessToken() && !admin.value) {
      try {
        await fetchProfile()
        return true
      } catch {
        logout()
        return false
      }
    }
    return !!getAccessToken()
  }

  return {
    admin,
    roles,
    loading,
    isLoggedIn,
    login,
    fetchProfile,
    setRoles,
    hasPermission,
    logout,
    restore,
  }
})