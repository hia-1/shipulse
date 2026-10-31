<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookCover, BaseButton } from '@/components/base'
import type { ShelfBook } from '@/api/bookshelf'

/**
 * 书架列表书籍卡片（横排）
 * 展示书封 + 书名/作者 + 进度条 + 最近阅读时间 + 状态切换 + 移除。
 */
const props = defineProps<{ item: ShelfBook }>()
const emit = defineEmits<{
  remove: [bookId: number]
  switchStatus: [bookId: number, status: 'want' | 'reading' | 'read']
}>()

const router = useRouter()

const statusLabels: Record<string, string> = {
  want: '想读',
  reading: '在读',
  read: '已读',
}

const progressWidth = computed(() => `${Math.min(100, Math.max(0, props.item.progress))}%`)

const lastReadText = computed(() => {
  if (!props.item.lastReadAt) return '尚未阅读'
  const diff = Date.now() - new Date(props.item.lastReadAt).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(props.item.lastReadAt).toLocaleDateString('zh-CN')
})

const pageText = computed(() => {
  const pages = props.item.book.pages || 0
  if (props.item.currentPage > 0) {
    return pages > 0
      ? `${props.item.currentPage} / ${pages} 页`
      : `第 ${props.item.currentPage} 页`
  }
  return ''
})

function goDetail() {
  router.push(`/books/${props.item.bookId}`)
}
</script>

<template>
  <div class="flex gap-md rounded-lg bg-paper-elevated border border-hairline p-md shadow-level-1 transition-all hover:shadow-level-2">
    <!-- 书封 -->
    <div
      class="w-[72px] flex-shrink-0 cursor-pointer"
      @click="goDetail"
    >
      <BookCover :src="item.book.coverUrl || undefined" :title="item.book.title" />
    </div>

    <!-- 信息区 -->
    <div class="flex min-w-0 flex-1 flex-col gap-xs">
      <div class="flex items-start justify-between gap-sm">
        <h3
          class="line-clamp-1 cursor-pointer text-title-md text-ink-primary transition-colors hover:text-pine-deep"
          @click="goDetail"
        >
          {{ item.book.title }}
        </h3>
        <span
          class="flex-shrink-0 rounded-full px-sm py-[2px] text-label-sm font-medium"
          :class="{
            'bg-pine-subtle text-pine-deep': item.status === 'reading',
            'bg-paper-warm text-ink-muted': item.status === 'want',
            'bg-gold-tint/30 text-gold-patina': item.status === 'read',
          }"
        >
          {{ statusLabels[item.status] }}
        </span>
      </div>

      <p class="line-clamp-1 text-body-sm text-ink-muted">{{ item.book.author }}</p>

      <!-- 进度条 -->
      <div v-if="item.status === 'reading'" class="mt-2xs">
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-paper-warm">
          <div
            class="h-full rounded-full bg-pine-deep transition-all duration-300"
            :style="{ width: progressWidth }"
          />
        </div>
        <div class="mt-2xs flex items-center justify-between text-label-sm text-ink-muted">
          <span>{{ item.progress }}%</span>
          <span v-if="pageText">{{ pageText }}</span>
        </div>
      </div>

      <!-- 已读：显示评分 -->
      <div v-else-if="item.status === 'read' && item.book.ratingAvg > 0" class="text-label-sm text-gold-patina">
        ★ {{ item.book.ratingAvg.toFixed(1) }}
      </div>

      <!-- 最近阅读时间 -->
      <div class="mt-auto flex items-center gap-xs text-label-sm text-ink-faint">
        <span>{{ lastReadText }}</span>
        <span v-if="pageText && item.status !== 'reading'">· {{ pageText }}</span>
      </div>

      <!-- 操作区 -->
      <div class="flex items-center gap-xs pt-2xs">
        <select
          class="rounded border border-hairline bg-paper-elevated px-sm py-[2px] text-label-sm text-ink-secondary outline-none focus:border-pine-deep"
          :value="item.status"
          @change="emit('switchStatus', item.bookId, ($event.target as HTMLSelectElement).value as 'want' | 'reading' | 'read')"
        >
          <option value="want">想读</option>
          <option value="reading">在读</option>
          <option value="read">已读</option>
        </select>
        <BaseButton
          variant="text"
          class="text-label-sm text-ink-muted hover:text-danger"
          @click="emit('remove', item.bookId)"
        >
          移除
        </BaseButton>
      </div>
    </div>
  </div>
</template>
