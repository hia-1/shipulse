const { request } = require('../../utils/request.js')
const { formatRating } = require('../../utils/format.js')

const HISTORY_KEY = 'sp_search_history'
const HISTORY_MAX = 10

function readHistory() {
  try {
    return wx.getStorageSync(HISTORY_KEY) || []
  } catch (e) {
    return []
  }
}

Page({
  data: {
    keyword: '',
    hot: [],
    history: [],
    suggestBooks: [],
    isbnHit: null,
    isbnCoverFailed: false,
    searching: false,
    searched: false,
    error: '',
  },

  onLoad(options) {
    this.setData({ history: readHistory() })
    this.loadHot()
    if (options && options.keyword) {
      this.setData({ keyword: decodeURIComponent(options.keyword) })
      this.doSearch()
    }
  },

  /** 记录搜索词：去重 + 最近 10 条 */
  saveHistory(keyword) {
    const list = [keyword]
      .concat(readHistory().filter((x) => x !== keyword))
      .slice(0, HISTORY_MAX)
    try {
      wx.setStorageSync(HISTORY_KEY, list)
    } catch (e) {}
    this.setData({ history: list })
  },

  onClearHistory() {
    wx.showModal({
      title: '清空搜索历史',
      content: '确定清空本地搜索历史吗？',
      success: (r) => {
        if (!r.confirm) return
        try {
          wx.removeStorageSync(HISTORY_KEY)
        } catch (e) {}
        this.setData({ history: [] })
      },
    })
  },

  loadHot() {
    request('/search/hot', { data: { limit: 10 }, auth: false })
      .then((list) => this.setData({ hot: list || [] }))
      .catch(() => {})
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onClear() {
    this.setData({
      keyword: '',
      suggestBooks: [],
      isbnHit: null,
      isbnCoverFailed: false,
      searched: false,
      error: '',
    })
  },

  onHotTap(e) {
    this.setData({ keyword: e.currentTarget.dataset.kw })
    this.doSearch()
  },

  doSearch() {
    const kw = (this.data.keyword || '').trim()
    if (!kw) {
      this.toast('请输入书名 / 作者 / ISBN')
      return
    }
    this.setData({ searching: true, error: '', isbnCoverFailed: false })
    request('/search/suggest', { data: { keyword: kw, limit: 10 }, auth: false })
      .then((res) => {
        this.setData({
          suggestBooks: this.decorate((res && res.books) || []),
          isbnHit: res ? res.isbnHit : null,
          searching: false,
          searched: true,
        })
        this.saveHistory(kw)
      })
      .catch((e) =>
        this.setData({
          searching: false,
          searched: true,
          error: (e && e.message) || '搜索失败',
        }),
      )
      .then(() => {
        request('/search/record', {
          method: 'POST',
          data: { keyword: kw },
          auth: false,
        }).catch(() => {})
      })
  },

  decorate(list) {
    return list.map((b) =>
      Object.assign({}, b, {
        ratingText: formatRating(b.ratingAvg),
        coverText: (b.title || '').slice(0, 4),
      }),
    )
  },

  onResultCoverError(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ [`suggestBooks[${index}].coverFailed`]: true })
  },

  onIsbnCoverError() {
    this.setData({ isbnCoverFailed: true })
  },

  goBook(e) {
    wx.navigateTo({ url: `/pages/book/book?id=${e.currentTarget.dataset.id}` })
  },

  toast(title) {
    wx.showToast({ title, icon: 'none' })
  },
})
