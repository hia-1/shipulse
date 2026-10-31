import { http } from './index'

export interface AdminInfo {
  id: number
  username: string
  name: string
  avatarUrl: string
  status?: string
  lastLoginAt?: string | null
  /** 角色编码列表（后端返回后权限即时生效） */
  roles?: string[]
}

export interface AdminLoginResult {
  accessToken: string
  refreshToken: string
  admin: AdminInfo
}

export function login(data: { username: string; password: string }) {
  return http.post<AdminLoginResult>('/admin/login', data)
}

export function getProfile() {
  return http.get<AdminInfo>('/admin/profile')
}

export async function fetchHealth() {
  const res = await http.get('/health', { baseURL: '' })
  return res.data
}