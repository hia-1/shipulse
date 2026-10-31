const { request } = require('../../utils/request.js')
const auth = require('../../utils/auth.js')
const { formatMinutes } = require('../../utils/format.js')

function pad(n) {
  return `${n}`.padStart(2, '0')
}

/** 秒 → 计时器展示（不足 1 小时为 mm:ss，否则 h:mm:ss） */
function hms(total) {
  const s = Math.max(0, Math.floor(total))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

Page({
  data: {
    needLogin: false,
    bookId: null,
    bookTitle: '',
    coverUrl: '',
    status: 'idle', // idle | running | finished
    sessionId: null,
    startPage: '',
    endPage: '',
    note: '',
    elapsed: 0,
    elapsedText: '00:00',
    durationText: '0 分钟',
    coverFailed: false,
    starting: false,
    finishing: false,
    resumed: false,
    error: '',
  },

  onLoad(options) {
    const opts = options || {}
    this.setData({
      bookId: opts.id ? Number(opts.id) : null,
      bookTitle: opts.title ? decodeURIComponent(opts.title) : '',
      coverUrl: opts.cover ? decodeURIComponent(opts.cover) : '',
    })
    if (!auth.isLoggedIn()) {
      this.setData({ needLogin: true })
      return
    }
    this.resumeOngoing()
  },

  onShow() {
    // 从后台回到前台时补一次计时，避免 setInterval 被挂起导致读数停滞
    if (this.data.status === 'running') this.tick()
  },

  onUnload() {
    this.clearTimer()
  },

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  startTimer() {
    this.clearTimer()
    this.timer = setInterval(() => this.tick(), 1000)
    this.tick()
  },

  tick() {
    if (this.data.status !== 'running' || !this.startAt) return
    const elapsed = Math.max(0, Math.floor((Date.now() - this.startAt) / 1000))
    this.setData({
      elapsed,
      elapsedText: hms(elapsed),
      durationText: formatMinutes(elapsed / 60),
    })
  },

  /** 恢复进行中的场次（含 Web 端未结束的计时，保证同账号互通） */
  resumeOngoing() {
    request('/reading/sessions/ongoing')
      .then((s) => {
        if (!s) return
        this.startAt = new Date(s.startTime).getTime()
        this.setData({
          sessionId: s.sessionId,
          bookId: s.bookId,
          bookTitle: s.bookTitle,
          coverUrl: s.coverUrl,
          startPage: s.startPage ? String(s.startPage) : '',
          status: 'running',
          resumed: true,
        })
        this.startTimer()
        wx.showToast({ title: '已恢复未结束的计时', icon: 'none' })
      })
      .catch(() => {})
  },

  onStartPageInput(e) {
    this.setData({ startPage: e.detail.value })
  },

  onEndPageInput(e) {
    this.setData({ endPage: e.detail.value })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onCoverError() {
    this.setData({ coverFailed: true })
  },

  onStart() {
    if (this.data.starting) return
    if (!this.data.bookId) {
      this.toast('缺少书籍信息')
      return
    }
    const startPage = parseInt(this.data.startPage, 10)
    this.setData({ starting: true, error: '' })
    request('/reading/sessions', {
      method: 'POST',
      data: {
        bookId: this.data.bookId,
        startPage: Number.isFinite(startPage) ? startPage : 0,
        source: 'miniprogram',
      },
    })
      .then((s) => {
        this.startAt = Date.now()
        this.setData({
          sessionId: s.sessionId,
          status: 'running',
          starting: false,
          resumed: false,
        })
        this.startTimer()
      })
      .catch((e) =>
        this.setData({ starting: false, error: (e && e.message) || '开始失败' }),
      )
  },

  onFinish() {
    if (this.data.finishing) return
    const endPage = parseInt(this.data.endPage, 10)
    if (!Number.isFinite(endPage) || endPage < 0) {
      this.toast('请填写结束页码')
      return
    }
    this.setData({ finishing: true })
    request(`/reading/sessions/${this.data.sessionId}/finish`, {
      method: 'PATCH',
      data: {
        endPage,
        note: this.data.note || '',
        durationSeconds: this.data.elapsed,
      },
    })
      .then((s) => {
        this.clearTimer()
        this.setData({
          status: 'finished',
          finishing: false,
          durationText: formatMinutes((s.durationSeconds || this.data.elapsed) / 60),
        })
        wx.showToast({ title: '已结束并记录', icon: 'success' })
      })
      .catch((e) =>
        this.setData({ finishing: false, error: (e && e.message) || '结束失败' }),
      )
  },

  onRestart() {
    this.startAt = null
    this.setData({
      status: 'idle',
      sessionId: null,
      elapsed: 0,
      elapsedText: '00:00',
      durationText: '0 分钟',
      endPage: '',
      note: '',
      resumed: false,
      error: '',
    })
  },

  goPulse() {
    wx.switchTab({ url: '/pages/pulse/pulse' })
  },

  goLogin() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
