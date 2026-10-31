import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { startSession, finishSession, getOngoingSession } from '@/api/reading'
import { useUserStore } from './user'

const TIMER_STORAGE_KEY = 'shipulse_timer_state'

type TimerStatus = 'idle' | 'running' | 'paused'

interface SavedTimerState {
  status: TimerStatus
  sessionId: number
  bookId: number
  bookTitle: string
  coverUrl: string
  startPage: number
  elapsedSeconds: number
}

export const useTimerStore = defineStore('timer', () => {
  const status = ref<TimerStatus>('idle')
  const sessionId = ref<number | null>(null)
  const bookId = ref<number | null>(null)
  const bookTitle = ref('')
  const coverUrl = ref('')
  const startPage = ref(0)
  const elapsedSeconds = ref(0)
  const loading = ref(false)

  let intervalId: ReturnType<typeof setInterval> | null = null
  // 以真实时间戳为基准累计秒数：后台标签页定时器被浏览器节流时仍能算准时长
  let tickBaseElapsed = 0
  let tickStartedAt = 0

  const isActive = computed(() => status.value !== 'idle')
  const isRunning = computed(() => status.value === 'running')
  const isPaused = computed(() => status.value === 'paused')

  const displayTime = computed(() => {
    const total = elapsedSeconds.value
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  })

  function saveState() {
    if (status.value === 'idle') {
      localStorage.removeItem(TIMER_STORAGE_KEY)
      return
    }
    const state: SavedTimerState = {
      status: status.value,
      sessionId: sessionId.value!,
      bookId: bookId.value!,
      bookTitle: bookTitle.value,
      coverUrl: coverUrl.value,
      startPage: startPage.value,
      elapsedSeconds: elapsedSeconds.value,
    }
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state))
  }

  function loadState(): SavedTimerState | null {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY)
    if (!raw) return null
    try {
      return JSON.parse(raw) as SavedTimerState
    } catch {
      return null
    }
  }

  function clearState() {
    localStorage.removeItem(TIMER_STORAGE_KEY)
  }

  /** 用真实经过时间刷新累计秒数（运行中才更新） */
  function syncElapsed() {
    if (status.value === 'running' && tickStartedAt > 0) {
      elapsedSeconds.value = tickBaseElapsed + Math.floor((Date.now() - tickStartedAt) / 1000)
    }
  }

  function startTick() {
    stopTick()
    tickBaseElapsed = elapsedSeconds.value
    tickStartedAt = Date.now()
    intervalId = setInterval(() => {
      syncElapsed()
      saveState()
    }, 1000)
  }

  function stopTick() {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    tickStartedAt = 0
  }

  async function start(params: {
    bookId: number
    bookTitle: string
    coverUrl: string
    startPage?: number
  }) {
    // 已有进行中的场次：同一本书直接续用；不同书先按「本地准确时长」结束旧场次，
    // 否则后端 createSession 会按墙钟（含暂停时间）自动结束旧场次，导致时长虚高
    if (isActive.value && sessionId.value != null) {
      if (bookId.value === params.bookId) {
        if (status.value === 'paused') resume()
        return
      }
      await finishCurrent()
    }

    loading.value = true
    try {
      const res = await startSession({
        bookId: params.bookId,
        startPage: params.startPage ?? 0,
        source: 'web',
      })
      const data = res.data
      sessionId.value = data.sessionId
      bookId.value = data.bookId
      bookTitle.value = params.bookTitle
      coverUrl.value = params.coverUrl
      startPage.value = params.startPage ?? 0
      elapsedSeconds.value = 0
      status.value = 'running'
      startTick()
      saveState()
    } finally {
      loading.value = false
    }
  }

  /** 结束当前进行中的场次并上报准确时长（失败不阻塞后续流程） */
  async function finishCurrent() {
    syncElapsed()
    stopTick()
    const sid = sessionId.value
    if (sid == null) return
    try {
      await finishSession(sid, { durationSeconds: elapsedSeconds.value })
    } catch {
      /* 旧场次结束失败不阻塞新场次：后端 createSession 会自动结束进行中的场次 */
    }
  }

  function pause() {
    if (status.value !== 'running') return
    syncElapsed()
    status.value = 'paused'
    stopTick()
    saveState()
  }

  function resume() {
    if (status.value !== 'paused') return
    status.value = 'running'
    startTick()
    saveState()
  }

  async function stop(endPage?: number, note?: string) {
    syncElapsed()
    const sid = sessionId.value
    loading.value = true
    try {
      if (sid != null) {
        await finishSession(sid, {
          endPage,
          note,
          durationSeconds: elapsedSeconds.value,
        })
      }
    } catch {
      /* 结束失败也复位本地状态，避免计时器卡死；未结束的服务端场次会在下次开始时自动结束 */
    } finally {
      reset()
      loading.value = false
    }
  }

  function reset() {
    stopTick()
    status.value = 'idle'
    sessionId.value = null
    bookId.value = null
    bookTitle.value = ''
    coverUrl.value = ''
    startPage.value = 0
    elapsedSeconds.value = 0
    clearState()
  }

  async function restore() {
    const userStore = useUserStore()
    if (!userStore.isLoggedIn) return

    const saved = loadState()
    if (!saved) {
      const res = await getOngoingSession()
      if (res.data) {
        const s = res.data
        sessionId.value = s.sessionId
        bookId.value = s.bookId
        bookTitle.value = s.bookTitle
        coverUrl.value = s.coverUrl
        startPage.value = s.startPage
        const elapsed = s.durationSeconds || Math.floor((Date.now() - new Date(s.startTime).getTime()) / 1000)
        elapsedSeconds.value = elapsed
        status.value = 'running'
        startTick()
        saveState()
      }
      return
    }

    const res = await getOngoingSession()
    if (res.data && res.data.sessionId === saved.sessionId) {
      sessionId.value = saved.sessionId
      bookId.value = saved.bookId
      bookTitle.value = saved.bookTitle
      coverUrl.value = saved.coverUrl
      startPage.value = saved.startPage
      elapsedSeconds.value = saved.elapsedSeconds
      status.value = saved.status === 'paused' ? 'paused' : 'running'
      if (status.value === 'running') startTick()
      saveState()
    } else {
      reset()
    }
  }

  return {
    status,
    sessionId,
    bookId,
    bookTitle,
    coverUrl,
    startPage,
    elapsedSeconds,
    loading,
    isActive,
    isRunning,
    isPaused,
    displayTime,
    start,
    pause,
    resume,
    stop,
    reset,
    restore,
  }
})
