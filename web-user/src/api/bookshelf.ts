import { http } from './index'

/** 书架三态：null 表示未加书架 */
export type ShelfStatus = 'want' | 'reading' | 'read' | null

export interface ShelfBook {
  id: number
  bookId: number
  status: Exclude<ShelfStatus, null>
  currentPage: number
  progress: number
  lastReadAt: string | null
  updatedAt: string
  book: {
    id: number
    title: string
    coverUrl: string
    author: string
    pages: number
    ratingAvg: number
    categoryName: string | null
    [key: string]: unknown
  }
}

export interface ShelfListResult {
  list: ShelfBook[]
  total: number
  page: number
  pageSize: number
}

/** 我对某本书的书架状态 */
export function fetchShelfStatus(bookId: number) {
  return http.get<{ status: ShelfStatus }>(`/bookshelf/status/${bookId}`)
}

/** 三态切换（互斥） */
export function setShelfStatus(
  bookId: number,
  status: Exclude<ShelfStatus, null>,
) {
  return http.put<{ status: ShelfStatus }>(`/bookshelf/${bookId}`, { status })
}

/** 移出书架 */
export function removeFromShelf(bookId: number) {
  return http.delete<{ ok: boolean }>(`/bookshelf/${bookId}`)
}

/** 更新阅读进度 */
export function updateShelfProgress(
  bookId: number,
  currentPage: number,
  progress: number,
) {
  return http.patch<{
    bookId: number
    currentPage: number
    progress: number
    lastReadAt: string
  }>(`/bookshelf/${bookId}/progress`, { currentPage, progress })
}

/** 我的书架列表（可按三态过滤） */
export function fetchMyShelf(
  page = 1,
  pageSize = 20,
  status?: Exclude<ShelfStatus, null>,
) {
  return http.get<ShelfListResult>('/bookshelf', {
    params: { page, pageSize, ...(status ? { status } : {}) },
  })
}
