<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTimerStore } from '@/stores/timer'
import { confirmDialog } from '@/composables/useConfirm'
import { BaseEmpty, BaseButton, BookCover } from '@/components/base'
import EndSessionModal from '@/components/reading/EndSessionModal.vue'
import { fetchMyShelf, type ShelfBook } from '@/api/bookshelf'
import { getTodaySummary, type TodaySummary } from '@/api/reading'

const router = useRouter()
const userStore = useUserStore()
const timer = useTimerStore()

const readingBooks = ref<ShelfBook[]>([])
const todaySummary = ref<TodaySummary>({ totalSeconds: 0, sessionCount: 0, bookCount: 0 })
const loading = ref(false)
const error = ref('')
const showEndModal = ref(false)

const todayTime = computed(() => {
  const total = todaySummary.value.totalSeconds
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  if (m > 0) return `${m} 分钟`
  return '尚未阅读'
})

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [shelfRes, summaryRes] = await Promise.all([
      fetchMyShelf(1, 50, 'reading'),
      getTodaySummary(),
    ])
    readingBooks.value = shelfRes.data.list
    todaySummary.value = summaryRes.data
  } catch (e) {
    error.value = (e as Error).message || '数据加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function handleStart(book: ShelfBook) {
  if (timer.isActive && timer.bookId !== book.bookId) {
    const ok = await confirmDialog({
      title: '切换书籍',
      message: `正在阅读《${timer.bookTitle}》，是否切换到《${book.book.title}》？当前计时将自动结束。`,
      confirmText: '切换',
    })
    if (!ok) return
  }
  await timer.start({
    bookId: book.bookId,
    bookTitle: book.book.title,
    coverUrl: book.book.coverUrl,
    startPage: book.currentPage,
  })
  await loadData()
}

function handleStopClick() {
  showEndModal.value = true
}

async function handleSessionFinished() {
  await loadData()
}

onMounted(async () => {
  await userStore.restore()
  await loadData()
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <!-- 页头 -->
      <div class="mb-lg flex items-center justify-between">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">书房</h1>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" @click="router.push('/pulse-report')">时脉报告</BaseButton>
          <BaseButton variant="ghost" @click="router.push('/bookshelf')">我的书架</BaseButton>
        </div>
      </div>

      <!-- 今日时脉概览 -->
      <div class="mb-lg grid grid-cols-3 gap-md">
        <div class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1">
          <p class="text-label-sm text-ink-muted">今日时长</p>
          <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ todayTime }}</p>
        </div>
        <div class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1">
          <p class="text-label-sm text-ink-muted">阅读场次</p>
          <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ todaySummary.sessionCount }}</p>
        </div>
        <div class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1">
          <p class="text-label-sm text-ink-muted">阅读书目</p>
          <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ todaySummary.bookCount }}</p>
        </div>
      </div>

      <!-- 进行中的计时提示 -->
      <div v-if="timer.isActive" class="mb-lg flex items-center justify-between rounded-lg bg-pine-subtle border border-pine-deep/20 p-md">
        <div class="flex items-center gap-sm">
          <span class="text-body-md text-pine-deep">正在阅读《{{ timer.bookTitle }}》</span>
          <span class="text-body-md font-serif tabular-nums text-pine-deep font-medium">{{ timer.displayTime }}</span>
        </div>
        <BaseButton variant="primary" @click="handleStopClick">结束计时</BaseButton>
      </div>

      <!-- 在读书籍 -->
      <div class="mb-md">
        <h2 class="text-title-lg text-ink-primary mb-md">在读的书</h2>

        <div v-if="error" class="rounded-lg border border-danger/30 bg-danger/5 p-md text-center text-body-sm text-danger">
          <p>{{ error }}</p>
          <BaseButton variant="ghost" class="mt-sm" @click="loadData">重试</BaseButton>
        </div>

        <div v-else-if="loading" class="py-xl text-center text-body-md text-ink-muted">加载中…</div>

        <div v-else-if="readingBooks.length > 0" class="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="book in readingBooks"
            :key="book.id"
            class="flex gap-md rounded-lg bg-paper-elevated border border-hairline p-md shadow-level-1 transition-all hover:shadow-level-2"
          >
            <!-- 书封 -->
            <div
              class="w-[60px] flex-shrink-0 cursor-pointer"
              @click="router.push(`/books/${book.bookId}`)"
            >
              <BookCover :src="book.book.coverUrl || undefined" :title="book.book.title" />
            </div>

            <!-- 信息 + 操作 -->
            <div class="flex min-w-0 flex-1 flex-col">
              <h3
                class="line-clamp-1 cursor-pointer text-body-md text-ink-primary hover:text-pine-deep"
                @click="router.push(`/books/${book.bookId}`)"
              >
                {{ book.book.title }}
              </h3>
              <p class="line-clamp-1 text-label-sm text-ink-muted">{{ book.book.author }}</p>

              <!-- 进度 -->
              <div class="mt-2xs">
                <div class="h-1 w-full overflow-hidden rounded-full bg-paper-warm">
                  <div
                    class="h-full rounded-full bg-pine-deep"
                    :style="{ width: `${book.progress}%` }"
                  />
                </div>
                <p class="mt-2xs text-label-sm text-ink-faint tabular-nums">{{ book.progress }}% · 第 {{ book.currentPage }} 页</p>
              </div>

              <!-- 开始计时按钮 -->
              <BaseButton
                variant="primary"
                class="mt-auto pt-sm"
                :disabled="timer.isActive && timer.bookId === book.bookId"
                @click="handleStart(book)"
              >
                {{ timer.isActive && timer.bookId === book.bookId ? '计时中…' : '开始计时' }}
              </BaseButton>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <BaseEmpty
          v-else
          title="还没有在读的书"
          description="去书架找一本书标记为「在读」吧"
        >
          <template #icon>📖</template>
          <template #action>
            <BaseButton variant="primary" @click="router.push('/bookshelf')">去书架</BaseButton>
          </template>
        </BaseEmpty>
      </div>

      <!-- 结束计时弹窗 -->
      <EndSessionModal v-model="showEndModal" @finished="handleSessionFinished" />
    </div>
  </main>
</template>
