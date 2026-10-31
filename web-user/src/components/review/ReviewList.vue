<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listReviews, type ReviewItem } from '@/api/review'
import { useUserStore } from '@/stores/user'
import { BaseButton, BaseEmpty } from '@/components/base'
import ReviewCard from './ReviewCard.vue'
import ReviewComposer from './ReviewComposer.vue'

const props = defineProps<{ bookId: number; bookTitle: string }>()

const userStore = useUserStore()
const list = ref<ReviewItem[]>([])
const total = ref(0)
const loading = ref(true)
const composerOpen = ref(false)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await listReviews({ bookId: props.bookId, page: 1, pageSize: 20 })
    list.value = res.data.list
    total.value = res.data.total
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function onSubmmitted() {
  composerOpen.value = false
  void load()
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h2 class="text-title-lg text-ink-primary">
        书评
        <span v-if="total" class="ml-1 text-label-md text-ink-muted tabular-nums">{{ total }}</span>
      </h2>
      <BaseButton v-if="userStore.isLoggedIn" @click="composerOpen = true">
        写书评
      </BaseButton>
    </div>

    <div class="mt-sm">
      <div v-if="loading" class="space-y-sm">
        <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-lg bg-paper-warm" />
      </div>

      <BaseEmpty v-else-if="error" title="书评加载失败" :description="error" />

      <div v-else-if="list.length" class="space-y-sm">
        <ReviewCard v-for="r in list" :key="r.id" :review="r" />
      </div>

      <div v-else class="flex flex-col items-center gap-sm rounded-lg border border-hairline bg-paper-elevated py-lg shadow-level-1">
        <BaseEmpty
          :title="userStore.isLoggedIn ? '还没有书评' : '来写第一篇书评'"
          :description="userStore.isLoggedIn ? '读完一本书，写下你的读后感受' : '登录后写下你的读后感受'"
        />
        <RouterLink
          v-if="!userStore.isLoggedIn"
          to="/login"
          class="text-label-md text-pine-deep underline-offset-2 hover:underline"
        >
          登录写书评
        </RouterLink>
      </div>
    </div>

    <ReviewComposer
      :open="composerOpen"
      :book-id="bookId"
      :book-title="bookTitle"
      @close="composerOpen = false"
      @submitted="onSubmmitted"
    />
  </div>
</template>