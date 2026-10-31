<script setup lang="ts">
import { computed } from 'vue'
import { BookCover } from '@/components/base'
import type { BookItem } from '@/api/library'

/**
 * 书籍卡片（DESIGN.md Reading Cards）
 * 3:4 书封 + 书脊投影 + 书名/作者/评分，可复用于书城/榜单/推荐位。
 * 点击触发路由到书籍详情（P1-04 后启用）。
 */
const props = withDefaults(
  defineProps<{
    book: BookItem
    /** 是否展示星级评分 */
    showRating?: boolean
  }>(),
  { showRating: true },
)

const ratingText = computed(() =>
  props.book.ratingAvg > 0 ? props.book.ratingAvg.toFixed(1) : '',
)
</script>

<template>
  <div class="group/card flex flex-col">
    <RouterLink
      :to="`/books/${book.id}`"
      class="relative block overflow-hidden rounded-sm shadow-spine transition-all duration-200 group-hover/card:-translate-y-1 group-hover/card:shadow-level-2"
      :title="book.title"
    >
      <BookCover :src="book.coverUrl || undefined" :title="book.title" />
      <!-- 分数角标 -->
      <span
        v-if="showRating && ratingText"
        class="absolute right-xs top-xs rounded-full bg-paper-elevated/90 px-xs py-2xs text-label-sm tabular-nums text-gold-patina shadow-level-1"
      >
        ★ {{ ratingText }}
      </span>
    </RouterLink>

    <div class="mt-sm flex flex-col gap-2xs">
      <RouterLink
        :to="`/books/${book.id}`"
        class="line-clamp-2 text-title-md text-ink-primary transition-colors hover:text-pine-deep"
      >
        {{ book.title }}
      </RouterLink>
      <span class="line-clamp-1 text-body-sm text-ink-muted">{{ book.author }}</span>
      <div v-if="showRating" class="flex items-center gap-xs text-label-sm text-ink-faint">
        <span v-if="book.ratingCount > 0" class="tabular-nums">{{ book.ratingCount }} 人评分</span>
        <span v-else class="text-ink-faint">暂无评分</span>
      </div>
    </div>
  </div>
</template>