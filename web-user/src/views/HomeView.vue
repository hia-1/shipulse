<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { getDiscover, type RankKey, type HomeBanner } from '@/api/home'
import { BaseEmpty, BookCover } from '@/components/base'
import BookCard from '@/components/book/BookCard.vue'
import Stars from '@/components/review/Stars.vue'

const userStore = useUserStore()
const notiStore = useNotificationStore()

const discover = ref<Awaited<ReturnType<typeof getDiscover>>['data'] | null>(null)
const loading = ref(true)
const error = ref('')

// Banner 轮播
const bannerIndex = ref(0)
let bannerTimer: ReturnType<typeof setInterval> | null = null

// 榜单 Tab
const rankTabs: { key: RankKey; name: string }[] = [
  { key: 'hot', name: '热门榜' },
  { key: 'new', name: '新书榜' },
  { key: 'rating', name: '高分榜' },
]
const activeRankKey = ref<RankKey>('hot')

const activeRank = computed(
  () => discover.value?.rankEntries.find((r) => r.key === activeRankKey.value) ?? null,
)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getDiscover()
    discover.value = res.data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

type BannerTarget = { href: string; external: boolean }

// 仅允许站内 book/booklist 路径与显式 http(s) 外链；其余（含 //host 协议相对地址）回退首页，避免开放重定向
function bannerTarget(b: HomeBanner): BannerTarget {
  const raw = String(b.linkValue ?? '').trim()
  if ((b.linkType === 'book' || b.linkType === 'booklist') && /^\d+$/.test(raw)) {
    return { href: (b.linkType === 'book' ? '/books/' : '/booklists/') + raw, external: false }
  }
  if (b.linkType === 'web' && /^https?:\/\//i.test(raw)) {
    return { href: raw, external: true }
  }
  return { href: '/', external: false }
}

const bannerItems = computed(() =>
  (discover.value?.banners ?? []).map((b) => ({ ...b, ...bannerTarget(b) })),
)

function timeText(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
}

onMounted(async () => {
  await Promise.all([load(), userStore.restore()])
  bannerTimer = setInterval(() => {
    const n = discover.value?.banners.length ?? 0
    if (n > 1) bannerIndex.value = (bannerIndex.value + 1) % n
  }, 5000)
})

onUnmounted(() => {
  if (bannerTimer) clearInterval(bannerTimer)
})
</script>

<template>
  <div class="min-h-screen bg-paper-warm">
    <!-- 顶部导航 -->
    <header class="sticky top-0 z-30 border-b border-hairline bg-paper-elevated/95 backdrop-blur">
      <div class="mx-auto flex max-w-container items-center justify-between px-md py-sm">
        <RouterLink to="/" class="flex items-baseline gap-xs">
          <span class="font-serif text-title-lg text-pine-deep">时脉书社</span>
          <span class="hidden text-label-sm text-ink-muted sm:inline">记录每一次阅读的脉动</span>
        </RouterLink>
        <nav class="flex items-center gap-sm">
          <RouterLink to="/books" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">书城</RouterLink>
          <RouterLink to="/search" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">搜索</RouterLink>
          <RouterLink to="/feed" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">动态</RouterLink>
          <RouterLink to="/booklists/square" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">书单</RouterLink>
          <RouterLink
            v-if="userStore.isLoggedIn"
            to="/notifications"
            class="relative text-label-md text-ink-muted transition-colors hover:text-pine-deep"
          >
            消息
            <span
              v-if="notiStore.unread.total > 0"
              class="absolute -right-3 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-label-sm text-paper-elevated"
            >
              {{ notiStore.unread.total > 99 ? '99+' : notiStore.unread.total }}
            </span>
          </RouterLink>
          <RouterLink v-if="userStore.isLoggedIn" to="/profile" class="text-label-md text-ink-muted transition-colors hover:text-pine-deep">我的</RouterLink>
          <RouterLink
            v-else
            to="/login"
            class="rounded bg-pine-deep px-sm py-1 text-label-md text-paper-elevated transition-colors hover:bg-pine-hover"
          >登录</RouterLink>
        </nav>
      </div>
    </header>

    <main class="mx-auto max-w-container px-md py-lg">
      <!-- 加载骨架屏：避免首屏数据到达前空白 -->
      <div v-if="loading" class="animate-pulse">
        <div class="h-44 w-full rounded-lg bg-paper-warm sm:h-56 md:h-64"></div>
        <div class="mt-lg h-6 w-32 rounded bg-paper-warm"></div>
        <div class="mt-sm flex gap-md overflow-hidden">
          <div v-for="i in 5" :key="i" class="h-48 w-36 shrink-0 rounded bg-paper-warm"></div>
        </div>
        <div class="mt-xl h-6 w-32 rounded bg-paper-warm"></div>
        <div class="mt-sm grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-5">
          <div v-for="i in 5" :key="i" class="h-48 rounded bg-paper-warm"></div>
        </div>
      </div>

      <!-- Banner 轮播 -->
      <section v-if="!loading && discover?.banners.length" class="relative overflow-hidden rounded-lg shadow-level-1">
        <div class="flex transition-transform duration-500" :style="{ transform: `translateX(-${bannerIndex * 100}%)` }">
          <component
            v-for="b in bannerItems"
            :key="b.id"
            :is="b.external ? 'a' : 'RouterLink'"
            v-bind="
              b.external
                ? { href: b.href, target: '_blank', rel: 'noopener noreferrer' }
                : { to: b.href }
            "
            class="relative block h-44 w-full shrink-0 sm:h-56 md:h-64"
          >
            <img v-if="b.imageUrl" :src="b.imageUrl" :alt="b.title" class="h-full w-full object-cover" />
            <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-pine-deep to-pine-hover">
              <span class="text-title-lg text-paper-elevated/90">{{ b.title }}</span>
            </div>
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-primary/60 to-transparent px-md pb-sm pt-lg text-left">
              <p class="text-title-md text-paper-elevated">{{ b.title }}</p>
            </div>
          </component>
        </div>
        <div v-if="bannerItems.length > 1" class="absolute bottom-xs left-1/2 flex -translate-x-1/2 gap-1">
          <button
            v-for="(b, i) in bannerItems"
            :key="b.id"
            type="button"
            class="h-1.5 rounded-full transition-all"
            :class="i === bannerIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'"
            @click="bannerIndex = i"
          />
        </div>
      </section>

      <BaseEmpty v-if="error" title="首页加载失败" :description="error" />

      <!-- 每周好书 -->
      <section v-if="discover?.weeklyBooks.length" class="mt-lg">
        <div class="mb-sm flex items-center justify-between">
          <h2 class="text-title-lg text-ink-primary">本周好书</h2>
          <RouterLink to="/books" class="text-label-md text-ink-muted hover:text-pine-deep">查看全部 →</RouterLink>
        </div>
        <div class="flex snap-x gap-md overflow-x-auto pb-1">
          <div v-for="w in discover.weeklyBooks" :key="w.id" class="w-36 shrink-0 snap-start">
            <BookCard v-if="w.book" :book="w.book" />
            <div v-else class="rounded-sm shadow-spine"><BookCover :title="w.title" /></div>
            <p v-if="w.subtitle" class="mt-xs line-clamp-2 text-label-sm text-ink-muted">{{ w.subtitle }}</p>
          </div>
        </div>
      </section>

      <!-- 榜单 -->
      <section v-if="discover?.rankEntries.length" class="mt-xl">
        <div class="mb-sm flex items-end justify-between">
          <h2 class="text-title-lg text-ink-primary">阅读榜单</h2>
          <div class="flex gap-xs rounded-lg bg-paper-elevated p-xs shadow-level-1">
            <button
              v-for="t in rankTabs"
              :key="t.key"
              type="button"
              class="rounded px-md py-1 text-label-md transition-all"
              :class="activeRankKey === t.key ? 'bg-pine-deep text-paper-elevated font-medium' : 'text-ink-muted hover:text-ink-primary'"
              @click="activeRankKey = t.key"
            >
              {{ t.name }}
            </button>
          </div>
        </div>

        <div v-if="activeRank" class="grid grid-cols-2 gap-md sm:grid-cols-3 lg:grid-cols-5">
          <div v-for="(book, i) in activeRank.books" :key="book.id" class="relative">
            <span
              class="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full text-label-sm font-medium"
              :class="i < 3 ? 'bg-gold-tint text-gold-patina' : 'bg-paper-warm text-ink-muted'"
            >
              {{ i + 1 }}
            </span>
            <BookCard :book="book" />
          </div>
        </div>
        <BaseEmpty v-else title="榜单暂无内容" description="书籍被阅读后将在此上榜" />
      </section>

      <!-- 热门书评 -->
      <section v-if="discover?.hotReviews.length" class="mt-xl pb-lg">
        <div class="mb-sm flex items-center justify-between">
          <h2 class="text-title-lg text-ink-primary">热门书评</h2>
          <span class="text-label-md text-ink-muted">读后有感，同频分享</span>
        </div>
        <div class="grid gap-sm sm:grid-cols-2">
          <RouterLink
            v-for="r in discover.hotReviews"
            :key="r.id"
            :to="`/reviews/${r.id}`"
            class="flex gap-md rounded-lg border border-hairline bg-paper-elevated p-md shadow-level-1 transition-all hover:shadow-level-2"
          >
            <div class="h-20 w-14 shrink-0"><BookCover :src="r.coverUrl || undefined" :title="r.bookTitle" /></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-xs">
                <Stars :value="r.rating" :size="13" />
                <span class="text-label-sm tabular-nums text-ink-secondary">{{ (r.rating || 0).toFixed(1) }}</span>
                <span v-if="r.isFeatured" class="ml-auto rounded bg-gold-tint px-1 text-label-sm text-gold-patina">精选</span>
              </div>
              <h3 class="mt-xs line-clamp-1 font-serif text-title-md text-ink-primary">{{ r.title }}</h3>
              <p class="mt-1 line-clamp-2 text-body-sm text-ink-secondary">{{ r.contentPreview }}</p>
              <p class="mt-xs text-label-sm text-ink-muted">
                {{ r.author.nickname }}<span v-if="r.author.isMember" class="text-gold-patina">·会员</span>
                <span class="ml-1">《{{ r.bookTitle }}》</span>
                <span v-if="r.publishedAt" class="ml-1">{{ timeText(r.publishedAt) }}</span>
              </p>
            </div>
          </RouterLink>
        </div>
      </section>

      <!-- 底部 -->
      <footer class="mt-lg border-t border-hairline py-lg text-center text-label-sm text-ink-faint">
        <div class="flex flex-wrap items-center justify-center gap-md">
          <RouterLink to="/help" class="hover:text-pine-deep">帮助中心</RouterLink>
          <RouterLink to="/feedback" class="hover:text-pine-deep">意见反馈</RouterLink>
          <RouterLink to="/about" class="hover:text-pine-deep">关于我们</RouterLink>
          <RouterLink to="/privacy" class="hover:text-pine-deep">隐私政策</RouterLink>
          <RouterLink to="/terms" class="hover:text-pine-deep">用户协议</RouterLink>
        </div>
        <p class="mt-2xs">时脉书社 · 阅读世界 — 让每一次阅读被看见</p>
      </footer>
    </main>
  </div>
</template>
