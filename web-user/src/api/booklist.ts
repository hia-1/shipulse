import type { AxiosRequestConfig } from 'axios'
import { http } from './index'

export interface BooklistCard {
  id: number
  title: string
  description: string
  coverUrl: string
  itemCount: number
  collectCount: number
  isOfficial: number
  creator: string
  publishedAt: string | null
  collected: boolean
}

export interface BooklistItemView {
  bookId: number
  title: string
  author: string
  coverUrl: string
  note: string
}

export interface BooklistDetail {
  id: number
  title: string
  description: string
  coverUrl: string
  itemCount: number
  collectCount: number
  isOfficial: number
  isMine: boolean
  auditStatus: string
  auditReason: string
  creator: string
  publishedAt: string | null
  collected: boolean
  books: BooklistItemView[]
}

export interface SquareResult {
  list: BooklistCard[]
  total: number
  page: number
  pageSize: number
  tags: string[]
}

/** 书单广场 */
export function listSquare(params: {
  tag?: string
  q?: string
  sort?: string
  page?: number
  pageSize?: number
}) {
  return http.get<SquareResult>('/booklists/square', { params })
}

/** 广场主题标签 */
export function listTags() {
  return http.get<string[]>('/booklists/tags')
}

/** 我的书单（创建 + 收藏） */
export function myBooklists() {
  return http.get<{ created: BooklistCard[]; collected: BooklistCard[] }>(
    '/booklists/my',
  )
}

/** 书单详情 */
export function booklistDetail(id: number) {
  return http.get<BooklistDetail>(`/booklists/${id}`)
}

/** 收录某书的书单 */
export function booklistsByBook(bookId: number, config?: AxiosRequestConfig) {
  return http.get<{ bookId: number; list: BooklistCard[] }>(
    `/booklists/book/${bookId}`,
    config,
  )
}

export function createBooklist(data: {
  title: string
  description?: string
  coverUrl?: string
  bookIds?: number[]
}) {
  return http.post<BooklistDetail>('/booklists', data)
}

export function updateBooklist(
  id: number,
  data: { title?: string; description?: string; coverUrl?: string },
) {
  return http.patch<BooklistDetail>(`/booklists/${id}`, data)
}

export function deleteBooklist(id: number) {
  return http.delete<{ deleted: boolean; id: number }>(`/booklists/${id}`)
}

export function addBookToBooklist(id: number, data: { bookId: number; note?: string }) {
  return http.post<BooklistDetail>(`/booklists/${id}/items`, data)
}

export function removeBookFromBooklist(id: number, bookId: number) {
  return http.delete<BooklistDetail>(`/booklists/${id}/items/${bookId}`)
}

export function collectBooklist(id: number) {
  return http.post<{ collected: boolean; collectCount: number; id: number }>(
    `/booklists/${id}/collect`,
  )
}

export function uncollectBooklist(id: number) {
  return http.delete<{ collected: boolean; collectCount: number }>(
    `/booklists/${id}/collect`,
  )
}