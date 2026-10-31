<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { toggleReviewLike } from '@/api/review'
import type { ReviewItem } from '@/api/review'
import Stars from './Stars.vue'

const props = defineProps<{ review: ReviewItem }>()

const router = useRouter()
const userStore = useUserStore()

const time = computed(() => {
  const d = props.review.publishedAt ?? props.review.createdAt
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
})

const isFeatured = computed(() => props.review.isFeatured)

async function onLike() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  try {
    const res = await toggleReviewLike(props.review.id)
    props.review.likeCount = res.data.likeCount
    props.review.isLiked = res.data.isLiked
  } catch {
    /* 点赞失败保持原状 */
  }
}
</script>

<template>
  <article
    class="flex gap-md rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 transition-shadow hover:shadow-level-2"
  >
    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-sm">
        <div class="flex min-w-0 items-center gap-xs">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pine-subtle text-label-sm text-pine-deep font-serif"
          >
            {{ review.author.nickname.charAt(0) }}
          </span>
          <span class="truncate text-label-md text-ink-primary font-medium">
            {{ review.author.nickname }}
          </span>
          <span
            v-if="review.author.isMember"
            class="text-label-sm text-gold-patina"
            title="会员书友"
          >会员</span>
          <span
            v-if="isFeatured"
            class="rounded bg-gold-tint px-1.5 text-label-sm text-gold-patina"
          >精选</span>
        </div>
        <span class="shrink-0 text-label-sm text-ink-muted tabular-nums">{{ time }}</span>
      </div>

      <p class="mt-xs flex items-center gap-sm">
        <Stars :value="Number(review.rating)" :size="14" />
        <span class="text-label-md text-ink-secondary tabular-nums">{{ Number(review.rating).toFixed(1) }}</span>
      </p>

      <h3 class="mt-xs font-serif text-title-md text-ink-primary">{{ review.title }}</h3>

      <p class="mt-xs line-clamp-3 whitespace-pre-line text-body-md leading-relaxed text-ink-secondary">
        {{ review.content }}
      </p>

      <div class="mt-md flex items-center gap-lg text-label-sm text-ink-muted">
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-pine-deep"
          :class="review.isLiked ? 'text-pine-deep' : 'text-ink-muted'"
          @click.stop.prevent="onLike"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" :fill="review.isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
          <span class="tabular-nums">{{ review.likeCount }}</span>
        </button>
        <span class="inline-flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          <span class="tabular-nums">{{ review.commentCount }}</span>
        </span>
        <RouterLink
          :to="`/reviews/${review.id}`"
          class="ml-auto text-pine-deep hover:underline"
        >
          阅读全文
        </RouterLink>
      </div>
    </div>
  </article>
</template>