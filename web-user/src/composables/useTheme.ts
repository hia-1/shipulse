import { ref, watch } from 'vue'

/**
 * 双主题切换：浅色 / 深色 / 跟随系统
 * 深色模式通过根节点 .dark 类启用（tailwind darkMode: 'class'）
 */
export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'shipulse-theme-mode'
const mode = ref<ThemeMode>((localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system')
const isDark = ref(false)

function apply() {
  isDark.value =
    mode.value === 'dark' ||
    (mode.value === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark.value)
}

let watching = false

export function useTheme() {
  if (!watching) {
    watching = true
    watch(mode, () => {
      localStorage.setItem(STORAGE_KEY, mode.value)
      apply()
    })
    // 跟随系统时监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (mode.value === 'system') apply()
    })
    apply()
  }

  return { mode, isDark }
}
