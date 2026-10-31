<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismissToast } = useToast()

const tone: Record<string, string> = {
  success: 'border-hairline bg-paper-elevated text-pine-deep',
  error: 'border-danger/30 bg-danger-container text-danger-content',
  info: 'border-hairline bg-paper-elevated text-ink-secondary',
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-md z-[100] flex flex-col items-center gap-xs px-md"
  >
    <TransitionGroup name="toast">
      <button
        v-for="t in toasts"
        :key="t.id"
        type="button"
        class="pointer-events-auto w-full max-w-md rounded-lg border px-md py-sm text-left text-body-sm shadow-level-2"
        :class="tone[t.type] ?? tone.info"
        role="alert"
        @click="dismissToast(t.id)"
      >
        {{ t.message }}
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>