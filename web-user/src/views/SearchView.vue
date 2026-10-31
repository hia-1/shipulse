<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SearchBox from '@/components/search/SearchBox.vue'
import BookCard from '@/components/book/BookCard.vue'
import ReviewCard from '@/components/review/ReviewCard.vue'
import { BaseChip, BaseEmpty, BaseButton } from '@/components/base'
import { fetchBooks, fetchBookByIsbn, type BookItem } from '@/api/library'
import { listReviews, type ReviewItem } from '@/api/review'
import { listSquare, type BooklistCard } from '@/api/booklist'

type TabType = 'books' | 'reviews' | 'booklists'

const route = useRoute()
const router = useRouter()

const keyword = ref((route.query.q as string) || '')
const activeTab = ref<TabType>('books')
const books = ref<BookItem[]>([])
const isbnHit = ref<BookItem | null>(null)
const total = ref(0)
const loading = ref(false)
const error = ref('')
const usingIsbn = ref(false)

// 书评结果
const reviews = ref<ReviewItem[]>([])
const reviewTotal = ref(0)
const reviewLoading = ref(false)
const reviewError = ref('')
const reviewLoadedFor = ref('')

// 书单结果
const booklists = ref<BooklistCard[]>([])
const booklistTotal = ref(0)
const booklistLoading = ref(false)
const booklistError = ref('')
const booklistLoadedFor = ref('')

const isbnClean = computed(() => keyword.value.replace(/[\s-]/g, ''))
const isIsbn = computed(() => /^\d{10}(\d{3})?$/.test(isbnClean.value))
const emptyTitle = computed(() => `未找到「${keyword.value}」相关内容`)

async function loadBooks() {
  const q = keyword.value.trim()
  if (!q) {
    books.value = []
    isbnHit.value = null
    total.value = 0
    return
  }
  loading.value = true
  error.value = ''
  isbnHit.value = null
  usingIsbn.value = isIsbn.value
  try {
    if (usingIsbn.value) {
      const res = await fetchBookByIsbn(isbnClean.value)
      isbnHit.value = res.data
    }
    const res = await fetchBooks({ page: 1, pageSize: 20, keyword: q, sort: 'default' })
    books.value = res.data.list
    total.value = res.data.total
  } catch (e) {
    error.value = (e as Error).message
    books.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

async function loadReviews() {
  const q = keyword.value.trim()
  if (!q) return
  reviewLoading.value = true
  reviewError.value = ''
  try {
    const res = await listReviews({ keyword: q, page: 1, pageSize: 20, sort: 'default' })
    reviews.value = res.data.list
    reviewTotal.value = res.data.total
    reviewLoadedFor.value = q
  } catch (e) {
    reviewError.value = (e as Error).message || '加载失败，请稍后重试'
    reviews.value = []
    reviewTotal.value = 0
  } finally {
    reviewLoading.value = false
  }
}

async function loadBooklists() {
  const q = keyword.value.trim()
  if (!q) return
  booklistLoading.value = true
  booklistError.value = ''
  try {
    const res = await listSquare({ q, page: 1, pageSize: 20 })
    booklists.value = res.data.list
    booklistTotal.value = res.data.total
    booklistLoadedFor.value = q
  } catch (e) {
    booklistError.value = (e as Error).message || '加载失败，请稍后重试'
    booklists.value = []
    booklistTotal.value = 0
  } finally {
    booklistLoading.value = false
  }
}

/** 切换 Tab：非书籍 Tab 首次进入时按当前关键词懒加载 */
function selectTab(t: TabType) {
  activeTab.value = t
  const q = keyword.value.trim()
  if (!q) return
  if (t === 'reviews' && reviewLoadedFor.value !== q) void loadReviews()
  if (t === 'booklists' && booklistLoadedFor.value !== q) void loadBooklists()
}

function onSubmit(kw: string) {
  if (!kw.trim()) return
  keyword.value = kw
  router.replace({ query: { q: kw.trim() } })
}

// 监听 URL query 变化（含首次进入与搜索框提交）
watch(
  () => route.query.q,
  (q) => {
    const next = (q as string) || ''
    keyword.value = next
    activeTab.value = 'books'
    reviewLoadedFor.value = ''
    booklistLoadedFor.value = ''
    if (next.trim()) void loadBooks()
    else {
      books.value = []
      total.value = 0
    }
  },
  { immediate: true },
)

function goDetail(id: number) {
  router.push(`/books/${id}`)
}

/** ISBN 直达卡片（模板 v-if 内的安全引用） */
const isbnCard = computed<BookItem | null>(() =>
  usingIsbn.value && isbnHit.value ? isbnHit.value : null,
)
</script>

<template>
  <div class="min-h-screen bg-paper-base">
    <main class="mx-auto w-full max-w-container px-md md:px-gutter-desktop">
      <!-- 顶部：品牌 + 搜索框 -->
      <div class="flex items-center gap-lg py-md">
        <RouterLink to="/" class="shrink-0 text-title-lg text-pine-deep">时脉书社</RouterLink>
        <div class="flex-1">
          <SearchBox v-model="keyword" autofocus @submit="onSubmit" />
        </div>
        <RouterLink to="/login" class="shrink-0 text-body-sm text-ink-secondary hover:text-pine-deep">登录</RouterLink>
      </div>

      <!-- 结果区 -->
      <template v-if="keyword.trim()">
        <!-- 当前关键词 + Tab -->
        <div class="border-t border-hairline pt-md">
          <p class="mb-md text-body-sm text-ink-muted">「{{ keyword }}」的搜索结果</p>
          <div class="mb-md flex gap-2xs">
            <BaseChip :selected="activeTab === 'books'" @click="selectTab('books')">
              书籍<template v-if="activeTab === 'books'"> ({{ usingIsbn && isbnHit ? total + 1 : total }})</template>
            </BaseChip>
            <BaseChip :selected="activeTab === 'reviews'" @click="selectTab('reviews')">
              书评<template v-if="reviewLoadedFor === keyword.trim()"> ({{ reviewTotal }})</template>
            </BaseChip>
            <BaseChip :selected="activeTab === 'booklists'" @click="selectTab('booklists')">
              书单<template v-if="booklistLoadedFor === keyword.trim()"> ({{ booklistTotal }})</template>
            </BaseChip>
          </div>
        </div>

        <!-- 书籍 Tab -->
        <div v-if="activeTab === 'books'">
          <!-- ISBN 直达卡片 -->
          <div
            v-if="isbnCard"
            class="mb-lg flex cursor-pointer items-center gap-md rounded-lg border border-pine-deep/30 bg-pine-subtle/40 p-md"
            @click="goDetail(Number(isbnCard.id))"
          >
            <img v-if="isbnCard.coverUrl" :src="isbnCard.coverUrl" class="h-20 w-14 flex-none rounded-sm object-cover shadow-spine" alt="" />
            <div class="min-w-0 flex-1">
              <p class="text-label-md text-pine-deep">ISBN 精确匹配（直达详情）</p>
              <p class="mt-2xs truncate text-title-lg text-ink-primary">{{ isbnCard.title }}</p>
              <p class="text-body-sm text-ink-muted">{{ isbnCard.author }}</p>
            </div>
          </div>

          <!-- 加载中骨架 -->
          <div v-if="loading" class="grid grid-cols-2 gap-x-md gap-y-lg min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <div v-for="i in 8" :key="i" class="aspect-[3/4] animate-pulse rounded-sm bg-paper-warm" />
          </div>

          <!-- 错误态（优先于空态展示，避免误报「未找到」） -->
          <div v-else-if="error" class="rounded-lg border border-danger/30 bg-danger/5 p-md text-center text-body-sm text-danger">
            <p>{{ error }}</p>
            <BaseButton variant="ghost" class="mt-sm" @click="loadBooks">重试</BaseButton>
          </div>

          <!-- 空态 -->
          <div v-else-if="!isbnHit && books.length === 0">
            <div class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl">
              <BaseEmpty
                :title="isIsbn ? '未找到该 ISBN 对应的书籍' : emptyTitle"
                description="换个关键词，或检查 ISBN 是否输入正确"
              />
            </div>
          </div>

          <!-- 结果流 -->
          <div v-else class="grid grid-cols-2 gap-x-md gap-y-lg pb-xl min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <BookCard v-for="b in books" :key="b.id" :book="b" @click="goDetail(b.id)" />
          </div>
        </div>

        <!-- 书评 Tab -->
        <div v-else-if="activeTab === 'reviews'" class="pb-2xl">
          <div v-if="reviewLoading" class="space-y-md">
            <div v-for="i in 3" :key="i" class="h-32 animate-pulse rounded-lg border border-hairline bg-paper-elevated" />
          </div>
          <div
            v-else-if="reviewError"
            class="rounded-lg border border-danger/30 bg-danger/5 p-md text-center text-body-sm text-danger"
          >
            <p>{{ reviewError }}</p>
            <BaseButton variant="ghost" class="mt-sm" @click="loadReviews">重试</BaseButton>
          </div>
          <div v-else-if="reviews.length" class="space-y-md">
            <ReviewCard v-for="r in reviews" :key="r.id" :review="r" />
          </div>
          <div v-else class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl">
            <BaseEmpty title="未找到相关书评" description="换个关键词，或去书籍详情页看看书评" />
          </div>
        </div>

        <!-- 书单 Tab -->
        <div v-else class="pb-2xl">
          <div v-if="booklistLoading" class="space-y-md">
            <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-lg border border-hairline bg-paper-elevated" />
          </div>
          <div
            v-else-if="booklistError"
            class="rounded-lg border border-danger/30 bg-danger/5 p-md text-center text-body-sm text-danger"
          >
            <p>{{ booklistError }}</p>
            <BaseButton variant="ghost" class="mt-sm" @click="loadBooklists">重试</BaseButton>
          </div>
          <div v-else-if="booklists.length" class="space-y-md">
            <RouterLink
              v-for="b in booklists"
              :key="b.id"
              :to="`/booklists/${b.id}`"
              class="block rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 transition-all hover:border-pine-deep hover:shadow-level-2"
            >
              <div class="flex items-start gap-md">
                <div
                  class="flex h-24 w-16 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep"
                  :style="b.coverUrl ? { backgroundImage: `url(${b.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
                >
                  <span v-if="!b.coverUrl" class="text-title-lg">{{ b.title.charAt(0) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-xs">
                    <p class="truncate text-body-md text-ink-primary font-medium">{{ b.title }}</p>
                    <span v-if="b.isOfficial" class="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-label-sm text-gold-patina">官方</span>
                  </div>
                  <p class="mt-0.5 line-clamp-2 text-body-sm text-ink-secondary">{{ b.description || '暂无简介' }}</p>
                  <p class="mt-1 text-label-md text-ink-muted">{{ b.creator }} · {{ b.itemCount }} 本</p>
                </div>
              </div>
            </RouterLink>
          </div>
          <div v-else class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl">
            <BaseEmpty title="未找到相关书单" description="换个关键词，或去书单广场逛逛" />
          </div>
        </div>
      </template>

      <!-- 无关键词空态 -->
      <div v-else class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl">
        <BaseEmpty title="输入关键词开始搜索" description="支持书名、作者，或直接扫贴 ISBN 直达书籍详情" />
      </div>
    </main>
  </div>
</template>