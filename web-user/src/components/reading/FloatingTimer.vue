<script setup lang="ts">
import { useTimerStore } from '@/stores/timer'
import { BookCover } from '@/components/base'
import { useTheme } from '@/composables/useTheme'

const timer = useTimerStore()
const { isDark } = useTheme()

const emit = defineEmits<{ stop: [] }>()
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="translate-y-20 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-20 opacity-0"
  >
    <div
      v-if="timer.isActive"
      class="fixed bottom-lg left-1/2 z-50 -translate-x-1/2"
    >
      <div
        class="flex items-center gap-md rounded-full border border-hairline px-md py-sm shadow-level-2"
        :style="{
          backgroundColor: isDark ? 'rgba(35, 39, 37, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
        }"
      >
        <!-- 书缩略图 -->
        <div class="h-10 w-8 flex-shrink-0 overflow-hidden rounded-sm">
          <BookCover :src="timer.coverUrl || undefined" :title="timer.bookTitle" />
        </div>

        <!-- 书名 + 时间 -->
        <div class="flex min-w-0 flex-col">
          <span class="max-w-32 truncate text-label-sm text-ink-secondary">{{ timer.bookTitle }}</span>
          <span class="text-title-md font-serif tabular-nums text-pine-deep">
            {{ timer.displayTime }}
          </span>
        </div>

        <!-- 控制按钮 -->
        <div class="flex items-center gap-xs pl-sm">
          <!-- 播放/暂停 -->
          <button
            v-if="timer.isRunning"
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-pine-subtle text-pine-deep transition-all hover:bg-pine-deep hover:text-paper-elevated"
            title="暂停"
            @click="timer.pause()"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          </button>
          <button
            v-else
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-pine-subtle text-pine-deep transition-all hover:bg-pine-deep hover:text-paper-elevated"
            title="继续"
            @click="timer.resume()"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>

          <!-- 停止 -->
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-paper-warm text-ink-muted transition-all hover:bg-danger hover:text-paper-elevated"
            title="结束计时"
            @click="emit('stop')"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
