<script setup lang="ts">
/**
 * 模态面板（Surface Level 3：磨砂背景 + backdrop blur 8px）
 */
import { onUnmounted, watch } from 'vue'
import { useTheme } from '@/composables/useTheme'

const props = defineProps<{
  open: boolean
  title?: string
}>()

const emit = defineEmits<{ close: [] }>()

const { isDark } = useTheme()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) window.addEventListener('keydown', onKeydown)
    else window.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center p-md"
        @click.self="emit('close')"
      >
        <!-- Level 3 磨砂遮罩（深色模式使用深色磨砂） -->
        <div
          class="absolute inset-0"
          style="backdrop-filter: blur(8px)"
          :style="{
            backgroundColor: isDark ? 'rgba(22, 24, 23, 0.85)' : 'rgba(251, 251, 250, 0.85)',
            border: isDark
              ? '1px solid rgba(46, 51, 49, 0.8)'
              : '1px solid rgba(234, 232, 227, 0.8)',
          }"
        />
        <div
          class="relative w-full max-w-md rounded-lg border border-hairline bg-paper-elevated shadow-level-2"
        >
          <div
            v-if="title"
            class="flex items-center justify-between border-b border-hairline px-lg py-md"
          >
            <h3 class="text-title-lg text-ink-primary">{{ title }}</h3>
            <button
              type="button"
              class="text-ink-muted transition-colors hover:text-ink-primary"
              aria-label="关闭"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>
          <div class="px-lg py-lg">
            <slot />
          </div>
          <div v-if="$slots.footer" class="border-t border-hairline px-lg py-md">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
