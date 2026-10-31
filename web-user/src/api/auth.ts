import { http } from './index'

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export interface UserInfo {
  id: number
  phone: string
  nickname: string
  avatarUrl: string
  gender: number
  bio: string
  status: string
  isMember: number
  memberExpireAt: string | null
  bookCount: number
  reviewCount: number
  postCount: number
  followerCount: number
  followingCount: number
  createdAt: string
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export function register(data: { phone: string; code: string; nickname?: string }) {
  return http.post<AuthResult>('/auth/register', data, { skipErrorToast: true })
}

export function login(data: { phone: string; code: string }) {
  return http.post<AuthResult>('/auth/login', data, { skipErrorToast: true })
}

export function refresh(data: { refreshToken: string }) {
  return http.post<TokenPair>('/auth/refresh', data)
}

export function getProfile() {
  return http.get<UserInfo>('/user/profile')
}
