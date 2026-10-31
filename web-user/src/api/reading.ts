import { http } from './index'

export interface SessionSummary {
  sessionId: number
  bookId: number
  bookTitle: string
  coverUrl: string
  startTime: string
  endTime: string | null
  durationSeconds: number
  startPage: number
  endPage: number
  note: string
  status: 'ongoing' | 'finished'
}

export interface TodaySummary {
  totalSeconds: number
  sessionCount: number
  bookCount: number
}

export interface SessionListResult {
  list: SessionSummary[]
  total: number
  page: number
  pageSize: number
}

/** 开始阅读场次 */
export function startSession(data: {
  bookId: number
  startPage?: number
  source?: string
}) {
  return http.post<SessionSummary>('/reading/sessions', data)
}

/** 结束阅读场次 */
export function finishSession(
  sessionId: number,
  data: { endPage?: number; note?: string; durationSeconds?: number },
) {
  return http.patch<SessionSummary>(
    `/reading/sessions/${sessionId}/finish`,
    data,
  )
}

/** 获取当前进行中的场次 */
export function getOngoingSession() {
  return http.get<SessionSummary | null>('/reading/sessions/ongoing')
}

/** 今日阅读概览 */
export function getTodaySummary() {
  return http.get<TodaySummary>('/reading/sessions/today-summary')
}

/** 阅读场次列表 */
export function listSessions(page = 1, pageSize = 20) {
  return http.get<SessionListResult>('/reading/sessions', {
    params: { page, pageSize },
  })
}

export interface DailyDuration {
  date: string
  seconds: number
  sessionCount: number
}

export interface AnnualReview {
  totalSeconds: number
  sessionCount: number
  bookCount: number
  finishedBookCount: number
  longestStreak: number
  currentStreak: number
}

/** 按日聚合阅读时长 */
export function getDailyDurations(start?: string, end?: string) {
  return http.get<DailyDuration[]>('/reading/pulse/daily', {
    params: { ...(start ? { start } : {}), ...(end ? { end } : {}) },
  })
}

/** 年度盘点 */
export function getAnnualReview(year?: number) {
  return http.get<AnnualReview>('/reading/pulse/annual', {
    params: { ...(year ? { year } : {}) },
  })
}

/** 导出阅读场次 CSV */
export function exportPulseCsv() {
  return http.get<{ csv: string }>('/reading/pulse/export')
}
