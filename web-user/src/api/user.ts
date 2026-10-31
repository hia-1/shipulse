import { http } from './index'
import type { UserInfo } from './auth'

/** 编辑个人资料 */
export function updateProfile(data: {
  nickname?: string
  avatarUrl?: string
  gender?: number
  bio?: string
}) {
  return http.patch<UserInfo>('/user/profile', data)
}

/** 注销账号（confirm 必须为 true） */
export function cancelAccount(confirm: boolean) {
  return http.post<{ deleted: boolean; id: number }>('/user/account/cancel', {
    confirm,
  })
}