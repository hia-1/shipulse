import { reactive } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const items = reactive<ToastItem[]>([])
let seq = 0

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  if (!message) return
  const id = ++seq
  items.push({ id, message, type })
  window.setTimeout(() => dismissToast(id), duration)
}

export function dismissToast(id: number) {
  const idx = items.findIndex((t) => t.id === id)
  if (idx !== -1) items.splice(idx, 1)
}

export function useToast() {
  return { toasts: items, showToast, dismissToast }
}