<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchCategoryTree,
  fetchTags,
  fetchBooks,
  type CategoryChild,
  type BookItem,
  type BookSort,
} from '@/api/library'
import { BaseChip, BaseEmpty, BaseButton } from '@/components/base'
import BookCard from '@/components/book/BookCard.vue'

const router = useRouter()

// 头部品牌
const brand = ref('时脉书社')

// 分类 & 标签数据源
const categories = ref<CategoryChild[]>([])
const tags = ref<{ id: number; name: string }[]>([])

// 当前筛选
const activeCategoryId = ref<string>('')
const activeTagId = ref<string>('')
const sort = ref<BookSort>('default')

// 加载状态
const books = ref<BookItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const page = ref(1)
const pageSize = 20
const finished = ref(false)

async function loadInit() {
  try {
    const [cats, tagList] = await Promise.all([fetchCategoryTree(), fetchTags()])
    categories.value = cats.data
    tags.value = tagList.data
  } catch {
    /* 分类/标签加载失败不阻塞主列表 */
  }
}

async function loadBooks(reset = false) {
  if (loading.value || loadingMore.value) return
  if (reset) {
    page.value = 1
    finished.value = false
    books.value = []
    loading.value = true
    error.value = ''
  } else {
    if (finished.value) return
    loadingMore.value = true
  }

  try {
    const res = await fetchBooks({
      page: page.value,
      pageSize,
      categoryId: activeCategoryId.value || undefined,
      tagId: activeTagId.value || undefined,
      sort: sort.value,
    })
    const list = res.data.list
    books.value = reset ? list : [...books.value, ...list]
    total.value = res.data.total
    if (page.value * pageSize >= res.data.total || list.length === 0) finished.value = true
    else page.value += 1
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

// 筛选/排序变化 → 重置并重新加载（reset=true 仅「全部」按钮使用，清空全部分类/标签/排序）
function applyFilter(reset: boolean) {
  if (reset) {
    activeCategoryId.value = ''
    activeTagId.value = ''
    sort.value = 'default'
  }
  void loadBooks(true)
}

// 标记数据源已就绪后再首启加载
const dataReady = ref(false)
watch(
  dataReady,
  (v) => {
    if (v) void loadBooks(true)
  },
  { once: true },
)

onMounted(async () => {
  await loadInit()
  dataReady.value = true
})

// 触底加载
function onScroll() {
  if (loading.value || loadingMore.value || finished.value) return
  const el = document.documentElement
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) {
    void loadBooks(false)
  }
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

function goDetail(id: number) {
  router.push(`/books/${id}`)
}

async function retryLoad() {
  await loadInit()
  await loadBooks(true)
}
</script>

<template>
  <div class="min-h-screen bg-paper-base">
    <!-- 顶部导航（与首页视觉统一：paper-elevated 磨砂 + hairline 分隔） -->
    <header class="sticky top-0 z-30 border-b border-hairline bg-paper-elevated/95 backdrop-blur">
      <div class="mx-auto flex max-w-container items-center justify-between px-md py-sm">
        <RouterLink to="/" class="flex items-baseline gap-xs">
          <span class="font-serif text-title-lg text-pine-deep">{{ brand }}</span>
          <span class="hidden text-label-sm text-ink-muted sm:inline">记录每一次阅读的脉动</span>
        </RouterLink>
        <nav class="flex items-center gap-sm">
          <RouterLink to="/" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">首页</RouterLink>
          <span class="text-label-md font-medium text-pine-deep">书城</span>
          <RouterLink to="/search" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">搜索</RouterLink>
          <RouterLink to="/login" class="rounded bg-pine-deep px-sm py-1 text-label-md text-paper-elevated transition-colors hover:bg-pine-hover">登录</RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-container px-md pt-lg md:px-gutter-desktop md:pt-xl">
      <div class="pb-2xl">
        <!-- 页面标题 -->
        <div class="pb-lg md:pb-xl">
          <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">书城</h1>
          <p class="mt-2xs text-body-sm text-ink-muted">按分类与标签，找到你想要的下一本书</p>
        </div>

        <!-- 排序 Tab：综合 / 最新 / 热门 / 高分 -->
        <div class="mb-lg flex items-center gap-xs overflow-x-auto pb-xs">
          <div class="flex gap-xs">
            <BaseChip :selected="sort === 'default'" @click="sort = 'default'; applyFilter(false)">
              综合
            </BaseChip>
            <BaseChip :selected="sort === 'new'" @click="sort = 'new'; applyFilter(false)">
              最新
            </BaseChip>
            <BaseChip :selected="sort === 'hot'" @click="sort = 'hot'; applyFilter(false)">
              热门
            </BaseChip>
            <BaseChip :selected="sort === 'rating'" @click="sort = 'rating'; applyFilter(false)">
              高分
            </BaseChip>
          </div>
        </div>

        <!-- 一级分类导航 -->
        <div class="mb-lg flex items-center gap-xs overflow-x-auto pb-xs">
          <BaseChip
            :selected="activeCategoryId === ''"
            @click="applyFilter(true)"
          >
            全部
          </BaseChip>
          <BaseChip
            v-for="c in categories"
            :key="c.id"
            :selected="activeCategoryId === String(c.id)"
            @click="activeCategoryId = String(c.id); applyFilter(false)"
          >
            {{ c.name }}
            <span class="ml-2xs text-ink-muted">({{ c.bookCount }})</span>
          </BaseChip>
        </div>

        <!-- 标签筛选 -->
        <div
          v-if="tags.length"
          class="mb-lg flex flex-wrap items-center gap-xs"
        >
          <BaseChip :selected="activeTagId === ''" @click="activeTagId = ''; applyFilter(false)">
            全部标签
          </BaseChip>
          <BaseChip
            v-for="t in tags"
            :key="t.id"
            :selected="activeTagId === String(t.id)"
            @click="activeTagId = String(t.id); applyFilter(false)"
          >
            #{{ t.name }}
          </BaseChip>
        </div>

        <!-- 结果统计 -->
        <p v-if="total > 0" class="mb-md text-label-sm text-ink-muted">
          共 {{ total }} 本书
        </p>

        <!-- 书籍卡片流 -->
        <template v-if="loading && books.length === 0">
          <div class="grid grid-cols-2 gap-x-md gap-y-lg min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <div
              v-for="i in 10"
              :key="i"
              class="animate-pulse aspect-[3/4] rounded-sm bg-paper-warm"
            />
          </div>
        </template>

        <template v-else-if="error && books.length === 0">
          <div class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl text-center">
            <p class="text-body-md text-danger">{{ error }}</p>
            <BaseButton variant="ghost" class="mt-md" @click="retryLoad">重试</BaseButton>
          </div>
        </template>

        <template v-else-if="books.length === 0">
          <div class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 py-xl">
            <BaseEmpty
              title="该分类下暂无书籍"
              description="换个分类或标签试试，我们正在不断补充书库"
            />
          </div>
        </template>

        <template v-else>
          <div class="grid grid-cols-2 gap-x-md gap-y-lg min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            <BookCard v-for="b in books" :key="b.id" :book="b" @click="goDetail(b.id)" />
          </div>

          <!-- 触底加载提示 -->
          <div class="py-lg text-center text-label-sm text-ink-faint">
            <span v-if="loadingMore">加载中…</span>
            <span v-else-if="finished && books.length > 0">— 已经到底了 —</span>
          </div>
        </template>
      </div>
    </main>
  </div>
</template>