import type { AxiosRequestConfig } from 'axios'
import { http } from './index'

export interface CategoryChild {
  id: number
  parentId: number
  name: string
  iconUrl: string
  sort: number
  bookCount: number
  children: CategoryChild[]
}

export interface TagItem {
  id: number
  name: string
  useCount: number
}

export interface BookItem {
  id: number
  isbn: string | null
  title: string
  subtitle: string
  author: string
  translator: string
  publisher: string
  publishedDate: string
  pages: number
  coverUrl: string
  description: string | null
  categoryId: number | null
  categoryName: string | null
  ratingAvg: number
  ratingCount: number
  reviewCount: number
  shelfCount: number
  wantCount: number
  readingCount: number
  finishedCount: number
  status: string
  publishedAt: string | null
  createdAt: string | null
}

export interface PagedBooks {
  list: BookItem[]
  total: number
  page: number
  pageSize: number
}

export type BookSort = 'default' | 'new' | 'hot' | 'rating'

export interface QueryBooks {
  page: number
  pageSize: number
  keyword?: string
  categoryId?: string
  tagId?: string
  sort?: BookSort
}

/** 分类树（一级 + 二级） */
export function fetchCategoryTree() {
  return http.get<CategoryChild[]>('/library/categories')
}

/** 标签列表（按引用数降序） */
export function fetchTags() {
  return http.get<TagItem[]>('/library/tags')
}

/** 书籍列表（分页/分类/标签/排序） */
export function fetchBooks(query: QueryBooks, config?: AxiosRequestConfig) {
  return http.get<PagedBooks>('/library/books', { params: query, ...config })
}

/** 按 ISBN 精确查（仅已上架，未命中返回 null） */
export function fetchBookByIsbn(isbn: string) {
  return http.get<BookItem | null>(`/library/books/isbn/${isbn}`)
}

export interface TagRef {
  id: number
  name: string
}

export interface BookDetail extends BookItem {
  tags: TagRef[]
}

/** 书籍详情（含分类名 + 标签） */
export function fetchBookDetail(id: number) {
  return http.get<BookDetail>(`/library/books/${id}`)
}