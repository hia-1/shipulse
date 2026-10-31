const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const store = require('../../utils/store.js')
const subscribe = require('../../utils/subscribe.js')
const { WEB_BASE } = require('../../config.js')

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const CAL_HEAD = ['一', '二', '三', '四', '五', '六', '日']

/** 本地时区 YYYY-MM-DD */
function localDate(d) {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本周周一 00:00 */
function startOfWeek(d) {
  const x = new Date(d)
  const offset = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - offset)
  x.setHours(0, 0, 0, 0)
  return x
}

/** 阅读时长 → 热力等级（0-4） */
function levelOf(seconds) {
  if (!seconds || seconds <= 0) return 0
  if (seconds < 900) return 1
  if (seconds < 1800) return 2
  if (seconds < 3600) return 3
  return 4
}

Page({
  data: {
    needLogin: false,
    loading: true,
    error: '',
    calHead: CAL_HEAD,
    today: { minutes: 0, sessionCount: 0, bookCount: 0 },
    week: { days: [], totalMinutes: 0, activeDays: 0 },
    calendar: { title: '', weeks: [] },
    templates: [],
    hasAuthorized: false,
    subscribeMock: true,
    sharing: false,
    share: null,
    webBase: WEB_BASE,
  },

  onLoad() {
    this.monthOffset = 0
    this.load()
  },

  onShow() {
    if (!this.data.loading) this.load()
  },

  onPullDownRefresh() {
    this.load().then(() => wx.stopPullDownRefresh())
  },

  load() {
    if (!auth.isLoggedIn()) {
      this.setData({ needLogin: true, loading: false })
      return Promise.resolve()
    }
    this.setData({ needLogin: false, loading: true, error: '' })

    const now = new Date()
    const wStart = startOfWeek(now)
    const wEnd = new Date(wStart)
    wEnd.setDate(wEnd.getDate() + 7)
    const mStart = new Date(now.getFullYear(), now.getMonth() + this.monthOffset, 1)
    const mEnd = new Date(now.getFullYear(), now.getMonth() + this.monthOffset + 1, 1)
    const from = wStart < mStart ? wStart : mStart
    const to = wEnd > mEnd ? wEnd : mEnd

    return Promise.all([
      request('/reading/sessions/today-summary'),
      request(`/reading/pulse/daily?start=${localDate(from)}&end=${localDate(to)}`),
      request('/subscribe/status').catch(() => null),
    ])
      .then(([today, daily, sub]) => {
        const list = daily || []
        const templates = (sub && sub.templates) || []
        this.setData({
          today: {
            minutes: Math.round((today.totalSeconds || 0) / 60),
            sessionCount: today.sessionCount || 0,
            bookCount: today.bookCount || 0,
          },
          week: this.buildWeek(wStart, list),
          calendar: this.buildCalendar(mStart, list),
          templates,
          hasAuthorized: templates.some((t) => t.authorized),
          subscribeMock: sub ? !!sub.mock : true,
          loading: false,
        })
      })
      .catch((e) =>
        this.setData({ loading: false, error: (e && e.message) || '加载失败' }),
      )
  },

  buildWeek(wStart, list) {
    const map = {}
    list.forEach((d) => {
      map[d.date] = d.seconds || 0
    })
    const todayStr = localDate(new Date())
    const secs = []
    let totalSeconds = 0
    let activeDays = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(wStart)
      d.setDate(wStart.getDate() + i)
      const s = map[localDate(d)] || 0
      secs.push(s)
      totalSeconds += s
      if (s > 0) activeDays += 1
    }
    const maxSec = Math.max.apply(null, secs.concat([0]))
    const days = secs.map((s, i) => {
      const d = new Date(wStart)
      d.setDate(wStart.getDate() + i)
      const ds = localDate(d)
      return {
        date: ds,
        label: WEEK_LABELS[i],
        seconds: s,
        minutes: Math.round(s / 60),
        isToday: ds === todayStr,
        level: levelOf(s),
        barHeight: maxSec > 0 && s > 0 ? Math.max(8, Math.round((s / maxSec) * 100)) : 0,
      }
    })
    return { days, totalMinutes: Math.round(totalSeconds / 60), activeDays }
  },

  buildCalendar(mStart, list) {
    const map = {}
    list.forEach((d) => {
      map[d.date] = d.seconds || 0
    })
    const year = mStart.getFullYear()
    const month = mStart.getMonth()
    const offset = (new Date(year, month, 1).getDay() + 6) % 7
    const gridStart = new Date(year, month, 1 - offset)
    const todayStr = localDate(new Date())
    const weeks = []
    for (let w = 0; w < 6; w++) {
      const row = []
      for (let d = 0; d < 7; d++) {
        const cur = new Date(gridStart)
        cur.setDate(gridStart.getDate() + w * 7 + d)
        const ds = localDate(cur)
        const seconds = map[ds] || 0
        row.push({
          date: ds,
          day: cur.getDate(),
          inMonth: cur.getMonth() === month,
          isToday: ds === todayStr,
          seconds,
          level: levelOf(seconds),
        })
      }
      // 末行若全为下月日期则省略
      if (w === 5 && row.every((c) => !c.inMonth)) break
      weeks.push(row)
    }
    return { title: `${year} 年 ${month + 1} 月`, weeks }
  },

  prevMonth() {
    this.monthOffset -= 1
    this.load()
  },

  nextMonth() {
    this.monthOffset += 1
    this.load()
  },

  onGenerateShare() {
    if (this.data.sharing) return
    const user = store.getUser() || {}
    this.setData({ sharing: true })
    request('/share', {
      method: 'POST',
      data: { type: 'pulse', targetId: user.id || 1 },
    })
      .then((res) => this.setData({ share: res, sharing: false }))
      .catch((e) => {
        this.setData({ sharing: false })
        this.toast((e && e.message) || '生成失败')
      })
  },

  onCopyLink() {
    const code = this.data.share && this.data.share.code
    if (!code) return
    wx.setClipboardData({
      data: `${WEB_BASE}/s/${code}`,
      success: () => this.toast('Web 链接已复制'),
    })
  },

  onSubscribe() {
    const ids = this.data.templates.map((t) => t.id)
    if (!ids.length) {
      this.toast('暂无可订阅的提醒')
      return
    }
    subscribe
      .requestSubscribe(ids)
      .then((res) => {
        if (!res.accepted.length) {
          this.toast('未授权，可稍后再开启')
          return
        }
        return subscribe.reportAuthorize(res.accepted).then(() => {
          this.toast('已开启阅读提醒')
          this.load()
        })
      })
      .catch((e) => this.toast((e && e.message) || '授权失败'))
  },

  onShareAppMessage() {
    const card = this.data.share && this.data.share.card
    return {
      title: (card && card.title) || '我的时脉 · 时脉书社',
      path: '/pages/index/index',
    }
  },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
