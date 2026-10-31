import { reactive } from 'vue'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  danger: boolean
  resolve: ((v: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: '请确认',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  danger: false,
  resolve: null,
})

/** 站内确认弹窗，返回用户是否确认（替代原生 confirm） */
export function confirmDialog(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options
  state.title = opts.title ?? '请确认'
  state.message = opts.message
  state.confirmText = opts.confirmText ?? '确定'
  state.cancelText = opts.cancelText ?? '取消'
  state.danger = opts.danger ?? false
  state.open = true
  return new Promise<boolean>((resolve) => {
    state.resolve = resolve
  })
}

function settle(v: boolean) {
  state.open = false
  const resolve = state.resolve
  state.resolve = null
  resolve?.(v)
}

export function useConfirm() {
  return {
    state,
    accept: () => settle(true),
    cancel: () => settle(false),
  }
}