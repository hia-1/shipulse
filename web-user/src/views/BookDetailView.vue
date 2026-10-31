<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  fetchBookDetail,
  fetchBooks,
  type BookDetail,
  type BookItem,
} from '@/api/library'
import { useUserStore } from '@/stores/user'
import BookCard from '@/components/book/BookCard.vue'
import ShelfStateMenu from '@/components/bookshelf/ShelfStateMenu.vue'
import ReviewList from '@/components/review/ReviewList.vue'
import { booklistsByBook, type BooklistCard } from '@/api/booklist'
import { BaseChip, BaseEmpty, BaseButton } from '@/components/base'
import ShareDialog from '@/components/share/ShareDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const bookId = computed(() => Number(route.params.id))
const book = ref<BookDetail | null>(null)
const loading = ref(true)
const error = ref('')
const reco = ref<BookItem[]>([])
const booklists = ref<BooklistCard[]>([])
const shareOpen = ref(false)

const rating = computed(() => (book.value ? Number(book.value.ratingAvg) : 0))

async function load() {
  book.value = null
  loading.value = true
  error.value = ''
  try {
    const res = await fetchBookDetail(bookId.value)
    book.value = res.data
  } catch (e) {
    error.value = (e as Error).message
    return
  } finally {
    loading.value = false
  }
  // 推荐与书单为附属数据，各自隔离失败：任一失败仅隐藏对应区块，不影响主体内容
  await Promise.all([loadReco(), loadBooklists()])
}

/** 收录书单（P2-01 联动） */
async function loadBooklists() {
  try {
    const res = await booklistsByBook(bookId.value, { skipErrorToast: true })
    booklists.value = res.data.list
  } catch {
    booklists.value = []
  }
}

/** 同类书推荐：同分类 → 兜底同标签 → 无则隐藏 */
async function loadReco() {
  const b = book.value
  if (!b) return
  try {
    let list: BookItem[] = []
    if (b.categoryId) {
      const res = await fetchBooks(
        { page: 1, pageSize: 6, categoryId: String(b.categoryId), sort: 'default' },
        { skipErrorToast: true },
      )
      list = res.data.list.filter((x) => x.id !== b.id)
    }
    if (list.length === 0 && b.tags?.[0]) {
      const res = await fetchBooks(
        { page: 1, pageSize: 6, tagId: String(b.tags[0].id), sort: 'default' },
        { skipErrorToast: true },
      )
      list = res.data.list.filter((x) => x.id !== b.id)
    }
    reco.value = list.slice(0, 6)
  } catch {
    // 推荐加载失败：隐藏推荐区块，不干扰书籍详情
    reco.value = []
  }
}

function onShelfChanged() {
  // 计数冗余字段变化 → 刷新详情页数字
  void load()
}

function goDetail(id: number) {
  if (id === bookId.value) return
  router.push(`/books/${id}`)
}

// 监听路由参数，切换书籍时重载（组件被复用时不重新挂载）
watch(bookId, () => load(), { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-paper-base">
    <main class="mx-auto max-w-container px-md py-md md:px-gutter-desktop">
      <p>
        <RouterLink to="/books" class="text-body-sm text-ink-muted hover:text-pine-deep">
          ← 返回书城
        </RouterLink>
      </p>

      <!-- 骨架 -->
      <div v-if="loading" class="mt-md grid gap-lg md:grid-cols-[210px,1fr]">
        <div class="aspect-[3/4] w-40 animate-pulse rounded-sm bg-paper-warm md:w-[210px]" />
        <div class="space-y-2xs">
          <div v-for="i in 3" :key="i" class="h-4 animate-pulse rounded bg-paper-warm" />
          <div class="mt-md h-10 w-72 animate-pulse rounded bg-paper-warm" />
        </div>
      </div>

      <!-- 错误 -->
      <BaseEmpty v-else-if="error" title="加载失败" :description="error" />

      <template v-else-if="book">
        <!-- Hero -->
        <section class="mt-md grid gap-lg md:grid-cols-[210px,1fr]">
          <div class="mx-auto w-40 md:mx-0 md:w-[210px]">
            <img
              v-if="book.coverUrl"
              :src="book.coverUrl"
              :alt="book.title"
              class="aspect-[3/4] w-full rounded-sm border border-hairline object-cover shadow-spine"
            />
            <div v-else class="flex aspect-[3/4] w-full items-center justify-center rounded-sm bg-paper-warm p-sm text-center text-title-lg text-ink-secondary shadow-spine">
              {{ book.title }}
            </div>
          </div>

          <div class="min-w-0">
            <h1 class="text-headline-lg-mobile md:text-headline-lg">{{ book.title }}</h1>
            <p v-if="book.subtitle" class="mt-2xs text-body-md text-ink-secondary">{{ book.subtitle }}</p>
            <p class="mt-xs text-body-sm text-ink-muted">
              {{ [book.author, book.translator ? `译 · ${book.translator}` : ''].filter(Boolean).join(' ｜ ') }}
            </p>

            <div class="mt-md flex flex-wrap gap-2xs">
              <span v-if="book.categoryName" class="text-label-sm text-ink-muted">{{ book.categoryName }}</span>
              <BaseChip v-for="t in book.tags" :key="t.id">#{{ t.name }}</BaseChip>
            </div>

            <!-- 综合评分 -->
            <div class="mt-md flex items-center gap-md rounded-lg border border-hairline bg-paper-elevated p-sm md:p-md" style="max-width: 34rem">
              <div class="text-center">
                <p class="text-[2.2rem] leading-none font-semibold text-gold-patina tabular-nums">{{ rating.toFixed(1) }}</p>
                <p class="mt-1 text-label-sm text-ink-muted">{{ book.ratingCount }} 人评分</p>
              </div>
              <div class="h-12 w-px bg-hairline" />
              <div class="grid grid-cols-2 gap-x-lg gap-y-2xs text-label-sm">
                <span class="text-ink-muted">想读 <b class="text-ink-primary tabular-nums">{{ book.wantCount }}</b></span>
                <span class="text-ink-muted">在读 <b class="text-ink-primary tabular-nums">{{ book.readingCount }}</b></span>
                <span class="text-ink-muted">已读 <b class="text-ink-primary tabular-nums">{{ book.finishedCount }}</b></span>
                <span class="text-ink-muted">加入书架 <b class="text-ink-primary tabular-nums">{{ book.shelfCount }}</b></span>
              </div>
            </div>

            <!-- 三态操作 -->
            <div class="mt-md max-w-md">
              <ShelfStateMenu :book-id="bookId" @changed="onShelfChanged" />
              <p v-if="!userStore.isLoggedIn" class="mt-2xs text-label-sm text-ink-faint">
                登录后可标记想读 / 在读 / 已读
              </p>
            </div>

            <div class="mt-sm">
              <BaseButton variant="ghost" @click="shareOpen = true">分享这本书</BaseButton>
            </div>

            <!-- 书目信息 -->
            <dl class="mt-md grid grid-cols-2 gap-x-lg gap-y-2xs text-body-sm md:grid-cols-3" style="max-width: 40rem">
              <div><dt class="text-ink-faint">出版社</dt><dd class="text-ink-secondary">{{ book.publisher || '—' }}</dd></div>
              <div><dt class="text-ink-faint">出版日期</dt><dd class="text-ink-secondary">{{ book.publishedDate || '—' }}</dd></div>
              <div><dt class="text-ink-faint">页数</dt><dd class="text-ink-secondary">{{ book.pages ? `${book.pages} 页` : '—' }}</dd></div>
              <div><dt class="text-ink-faint">ISBN</dt><dd class="text-ink-secondary tabular-nums">{{ book.isbn || '—' }}</dd></div>
            </dl>
          </div>
        </section>

        <!-- 简介 -->
        <section class="mt-xl">
          <h2 class="text-title-lg text-ink-primary">内容简介</h2>
          <div class="mt-sm whitespace-pre-line rounded-lg border border-hairline bg-paper-elevated p-md text-body-md leading-relaxed text-ink-secondary shadow-level-1">
            {{ book.description || '暂无简介' }}
          </div>
        </section>

        <!-- 收录书单（P2-01 联动） -->
        <section class="mt-xl">
          <h2 class="text-title-lg text-ink-primary">收录书单</h2>
          <div class="mt-sm rounded-lg border border-hairline bg-paper-elevated shadow-level-1">
            <div v-if="booklists.length" class="divide-y divide-hairline">
              <RouterLink
                v-for="bl in booklists"
                :key="bl.id"
                :to="`/booklists/${bl.id}`"
                class="flex items-center gap-sm px-lg py-md transition-colors hover:bg-paper-warm"
              >
                <div
                  class="flex h-12 w-10 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep"
                  :style="bl.coverUrl ? { backgroundImage: `url(${bl.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
                >
                  <span v-if="!bl.coverUrl" class="text-label-md">{{ bl.title.charAt(0) }}</span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-xs">
                    <p class="truncate text-body-md text-ink-primary font-medium">{{ bl.title }}</p>
                    <span v-if="bl.isOfficial" class="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-label-sm text-gold-patina">官方</span>
                  </div>
                  <p class="text-label-md text-ink-muted">
                    {{ bl.creator }} · {{ bl.itemCount }} 本 · {{ bl.collectCount }} 人收藏
                  </p>
                </div>
                <span class="text-ink-faint">→</span>
              </RouterLink>
            </div>
            <div v-else class="py-lg">
              <BaseEmpty title="暂无收录书单" description="这本书还没有被收入任何书单" />
            </div>
          </div>
        </section>

        <!-- 书评（P1-08 联动） -->
        <section class="mt-xl">
          <ReviewList :book-id="bookId" :book-title="book.title" />
        </section>

        <!-- 同类书推荐 -->
        <section v-if="reco.length" class="mt-xl">
          <h2 class="text-title-lg text-ink-primary">同类书籍</h2>
          <div class="mt-sm grid grid-cols-2 gap-x-md gap-y-lg min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            <BookCard v-for="b in reco" :key="b.id" :book="b" @click="goDetail(b.id)" />
          </div>
        </section>
      </template>
    </main>

    <ShareDialog
      v-if="book"
      :open="shareOpen"
      type="book"
      :target-id="bookId"
      title="分享这本书"
      @close="shareOpen = false"
    />
  </div>
</template>