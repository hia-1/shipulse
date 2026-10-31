import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAccessToken } from '@/api'
import { getUnreadCount, type UnreadCount } from '@/api/notification'

const EMPTY: UnreadCount = { total: 0, like: 0, comment: 0, system: 0 }

/**
 * 未读消息角标状态：登录态下轮询未读数，供全局导航展示。
 * 未登录或请求失败时静默归零，不打扰用户。
 */
export const useNotificationStore = defineStore('notification', () => {
  const unread = ref<UnreadCount>({ ...EMPTY })
  let timer: ReturnType<typeof setInterval> | null = null

  async function fetchUnread() {
    if (!getAccessToken()) {
      unread.value = { ...EMPTY }
      return
    }
    try {
      const res = await getUnreadCount()
      unread.value = res.data ?? { ...EMPTY }
    } catch {
      // 未读数失败不应影响页面；保持上次值
    }
  }

  function startPolling(intervalMs = 60000) {
    stopPolling()
    fetchUnread()
    timer = setInterval(fetchUnread, intervalMs)
  }

  function stopPolling() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function reset() {
    unread.value = { ...EMPTY }
  }

  return { unread, fetchUnread, startPolling, stopPolling, reset }
})