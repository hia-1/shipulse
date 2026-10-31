import { http } from './index'

export type ShareType = 'book' | 'review' | 'booklist' | 'post' | 'pulse'
export type ShareTemplate = 'pulse' | 'booklist' | 'review'

export interface ShareCardPayload {
  template: ShareTemplate
  code: string
  url: string
  title: string
  subtitle: string
  coverUrl: string
  quote: string
  rating: number | null
  author: { nickname: string; avatarUrl: string }
  stats: { label: string; value: string }[]
  footer: string
}

export interface ShareContent {
  type: ShareType
  targetId: number
  path: string
  title: string
  subtitle: string
  coverUrl: string
  description: string
  quote: string
  rating: number | null
  images: string[]
  author: { id: number; nickname: string; avatarUrl: string }
  stats: { label: string; value: string }[]
}

export interface ShareResult {
  code: string
  url: string
  card: ShareCardPayload
}

export interface ShareResolveResult {
  card: ShareCardPayload
  content: ShareContent
}

/** 生成/获取分享卡片与短码（时脉分享需登录） */
export function createShare(type: ShareType, targetId: number) {
  return http.post<ShareResult>('/share', { type, targetId })
}

/** 解析分享短码（分享落地页数据源，公开接口） */
export function resolveShare(code: string) {
  return http.get<ShareResolveResult>(`/share/${code}`, { skipErrorToast: true })
}
