<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchFeed,
  fetchFeedTopics,
  fetchTodayStatus,
  createCheckin,
  createTextPost,
  togglePostLike,
  type FeedItem,
  type FeedKind,
  type FeedTopic,
} from '@/api/feed'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/composables/useToast'
import { BaseButton, BaseEmpty, BaseInput, BaseModal, BaseTextarea } from '@/components/base'
import Stars from '@/components/review/Stars.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import { REPORT_TARGET_LABELS, type ReportTarget } from '@/api/report'

const router = useRouter()
const userStore = useUserStore()

const tabs: { value: FeedKind; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'checkin', label: '打卡' },
  { value: 'text', label: '图文' },
  { value: 'review', label: '书评' },
  { value: 'booklist', label: '书单' },
]

const type = ref<FeedKind>('all')
const sort = ref<'hot' | 'latest'>('hot')
const list = ref<FeedItem[]>([])
const loading = ref(true)
const hasMore = ref(false)
const error = ref('')
const page = ref(1)

// 话题筛选
const topics = ref<FeedTopic[]>([])
const activeTopicId = ref<number | null>(null)

async function loadTopics() {
  try {
    const res = await fetchFeedTopics()
    topics.value = res.data ?? []
  } catch {
    topics.value = []
  }
}

function switchTopic(id: number | null) {
  if (activeTopicId.value === id) return
  activeTopicId.value = id
  // 话题仅覆盖动态源，选中话题时重置类型为全部
  if (id) type.value = 'all'
  load(true)
}

/** 话题标题（用于在动态卡片上回显话题标签） */
function topicTitle(id?: number | null) {
  if (!id) return ''
  return topics.value.find((t) => t.id === id)?.title ?? ''
}

const today = ref<{ checkedToday: boolean; todayMinutes: number } | null>(null)

// 打卡 / 发布弹窗
const checkinOpen = ref(false)
const checkinForm = ref({ bookId: '', content: '' })
const checkinErr = ref('')
const checking = ref(false)

const composeOpen = ref(false)
const composeForm = ref({ content: '', imageUrl: '', location: '', topicId: '' })
const composeImages = ref<string[]>([])
const composeErr = ref('')
const posting = ref(false)

// 举报
const reportOpen = ref(false)
const reportTarget = ref<{ type: ReportTarget; id: number; label: string }>({
  type: 'post',
  id: 0,
  label: '',
})

function openReport(item: FeedItem) {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  const type: ReportTarget =
    item.kind === 'review' ? 'review' : item.kind === 'booklist' ? 'booklist' : 'post'
  reportTarget.value = {
    type,
    id: item.id,
    label: `${REPORT_TARGET_LABELS[type]}（${item.author.nickname}）`,
  }
  reportOpen.value = true
}

async function load(reset = false) {
  const targetPage = reset ? 1 : page.value + 1
  loading.value = true
  error.value = ''
  try {
    const res = await fetchFeed({
      type: type.value,
      sort: sort.value,
      page: targetPage,
      pageSize: 10,
      topicId: activeTopicId.value ?? undefined,
    })
    list.value = reset ? res.data.list : [...list.value, ...res.data.list]
    hasMore.value = res.data.hasMore
    // 仅在请求成功后提交页码，避免失败后重试跳页漏数据
    page.value = targetPage
  } catch (e) {
    const msg = (e as Error).message || '加载失败，请稍后重试'
    if (reset) error.value = msg
    else showToast(msg, 'error')
  } finally {
    loading.value = false
  }
}

function switchTab(t: FeedKind) {
  if (type.value === t) return
  type.value = t
  activeTopicId.value = null
  load(true)
}

function switchSort(s: 'hot' | 'latest') {
  if (sort.value === s) return
  sort.value = s
  load(true)
}

function loadMore() {
  if (loading.value) return
  load(false)
}

async function refreshToday() {
  if (!userStore.isLoggedIn) return
  try {
    const res = await fetchTodayStatus()
    today.value = res.data
  } catch {
    today.value = null
  }
}

async function toggleLike(item: FeedItem) {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    return
  }
  try {
    const res = await togglePostLike(item.id)
    item.isLiked = res.data.isLiked
    item.likeCount = res.data.likeCount
  } catch (e) {
    showToast((e as Error).message || '操作失败', 'error')
  }
}

function openCheckin() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login' })
    return
  }
  checkinForm.value = { bookId: '', content: '' }
  checkinErr.value = ''
  checkinOpen.value = true
  void refreshToday()
}

function openCompose() {
  if (!userStore.isLoggedIn) {
    router.push({ name: 'login' })
    return
  }
  composeForm.value = { content: '', imageUrl: '', location: '', topicId: '' }
  composeImages.value = []
  composeErr.value = ''
  composeOpen.value = true
}

function addImage() {
  const url = composeForm.value.imageUrl.trim()
  if (!url) return
  if (composeImages.value.length >= 9) {
    composeErr.value = '最多添加 9 张配图'
    return
  }
  if (!/^https?:\/\//i.test(url)) {
    composeErr.value = '图片 URL 必须是 http/https 开头的合法链接'
    return
  }
  if (!composeImages.value.includes(url)) composeImages.value.push(url)
  composeForm.value.imageUrl = ''
  composeErr.value = ''
}

async function submitCheckin() {
  const bookId = Number(checkinForm.value.bookId)
  if (!bookId) {
    checkinErr.value = '请输入图书 ID'
    return
  }
  checking.value = true
  checkinErr.value = ''
  try {
    await createCheckin({
      bookId,
      content: checkinForm.value.content.trim() || undefined,
    })
    checkinOpen.value = false
    await Promise.all([load(true), refreshToday()])
  } catch (e) {
    checkinErr.value = (e as Error).message
  } finally {
    checking.value = false
  }
}

async function submitCompose() {
  const content = composeForm.value.content.trim()
  if (!content) {
    composeErr.value = '写点什么吧'
    return
  }
  posting.value = true
  composeErr.value = ''
  try {
    await createTextPost({
      content,
      images: composeImages.value,
      location: composeForm.value.location.trim() || undefined,
      topicId: composeForm.value.topicId ? Number(composeForm.value.topicId) : undefined,
    })
    composeOpen.value = false
    await load(true)
  } catch (e) {
    composeErr.value = (e as Error).message
  } finally {
    posting.value = false
  }
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(iso).toLocaleDateString()
}

const kindTag: Record<FeedItem['kind'], string> = {
  checkin: '阅读打卡',
  text: '图文动态',
  review: '书评',
  booklist: '书单',
}

onMounted(() => {
  load(true)
  void refreshToday()
  void loadTopics()
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <!-- 页头 -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-serif text-headline-lg-mobile md:text-headline-lg text-pine-deep">动态流</h1>
            <p v-if="userStore.isLoggedIn && today" class="mt-0.5 text-label-md text-ink-muted">
              今日已读 {{ today.todayMinutes }} 分钟{{ today.checkedToday ? ' · 已打卡' : '' }}
            </p>
          </div>
          <div v-if="userStore.isLoggedIn" class="flex gap-sm">
            <BaseButton variant="ghost" :disabled="today?.checkedToday" @click="openCheckin">
              {{ today?.checkedToday ? '今日已打卡' : '阅读打卡' }}
            </BaseButton>
            <BaseButton variant="ghost" @click="openCompose">+ 发动态</BaseButton>
          </div>
        </div>

        <!-- 排序 + 类型筛选 -->
        <div class="space-y-sm">
          <div class="flex gap-sm">
            <button
              v-for="s in ([['hot', '热门'], ['latest', '最新']] as const)"
              :key="s[0]"
              type="button"
              class="rounded-full border px-md py-1 text-label-md transition-colors"
              :class="sort === s[0] ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
              @click="switchSort(s[0])"
            >
              {{ s[1] }}
            </button>
          </div>
          <div class="no-scrollbar flex gap-sm overflow-x-auto pb-sm -mx-md px-md">
            <button
              v-for="t in tabs"
              :key="t.value"
              type="button"
              class="shrink-0 rounded-full border px-md py-1 text-label-md transition-colors"
              :class="type === t.value ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
              @click="switchTab(t.value)"
            >
              {{ t.label }}
            </button>
          </div>
          <!-- 话题筛选（运营配置，实时生效） -->
          <div v-if="topics.length" class="no-scrollbar flex gap-sm overflow-x-auto pb-sm -mx-md px-md">
            <button
              type="button"
              class="shrink-0 rounded-full border px-md py-1 text-label-md transition-colors"
              :class="activeTopicId === null ? 'border-gold-patina bg-gold-tint text-gold-patina' : 'border-hairline text-ink-secondary'"
              @click="switchTopic(null)"
            >
              全部话题
            </button>
            <button
              v-for="tp in topics"
              :key="tp.id"
              type="button"
              class="shrink-0 rounded-full border px-md py-1 text-label-md transition-colors"
              :class="activeTopicId === tp.id ? 'border-gold-patina bg-gold-tint text-gold-patina' : 'border-hairline text-ink-secondary'"
              @click="switchTopic(tp.id)"
            >
              #{{ tp.title }}
            </button>
          </div>
        </div>

        <!-- 加载中（首次） -->
        <div v-if="loading && !list.length" class="space-y-md">
          <div
            v-for="i in 3"
            :key="i"
            class="h-40 animate-pulse rounded-lg border border-hairline bg-paper-elevated"
          />
        </div>

        <!-- 列表 -->
        <div v-else-if="list.length" class="space-y-md">
          <article
            v-for="item in list"
            :key="`${item.kind}-${item.id}`"
            class="rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1"
          >
            <!-- 作者行 -->
            <div class="flex items-center gap-sm">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-pine-subtle font-serif text-pine-deep"
                :style="item.author.avatarUrl ? { backgroundImage: `url(${item.author.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
              >
                <span v-if="!item.author.avatarUrl" class="text-label-md">{{ item.author.nickname.charAt(0) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <p class="flex items-center gap-xs">
                  <span class="truncate text-body-md text-ink-primary font-medium">{{ item.author.nickname }}</span>
                  <span v-if="item.author.isMember" class="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-label-sm text-gold-patina">会员</span>
                </p>
                <p class="text-label-md text-ink-muted">
                  {{ kindTag[item.kind] }} · {{ timeAgo(item.publishedAt) }}
                  <span v-if="topicTitle(item.topicId)" class="ml-1 text-gold-patina">#{{ topicTitle(item.topicId) }}</span>
                </p>
              </div>
            </div>

            <!-- 打卡 -->
            <template v-if="item.kind === 'checkin'">
              <RouterLink
                v-if="item.book"
                :to="`/books/${item.book.id}`"
                class="mt-md flex items-center gap-sm rounded border border-hairline bg-paper-warm p-sm"
              >
                <div class="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep"
                     :style="item.book.coverUrl ? { backgroundImage: `url(${item.book.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}">
                  <span v-if="!item.book.coverUrl" class="text-label-md">{{ item.book.title?.charAt(0) }}</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-body-md text-ink-primary font-medium">在读《{{ item.book.title }}》</p>
                  <p class="text-label-md text-gold-patina">今日阅读 {{ item.readMinutes }} 分钟</p>
                </div>
              </RouterLink>
              <div
                v-else
                class="mt-md flex items-center gap-sm rounded border border-hairline bg-paper-warm p-sm"
              >
                <div class="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep">
                  <span class="text-label-md">书</span>
                </div>
                <div class="min-w-0">
                  <p class="truncate text-body-md text-ink-muted font-medium">关联书籍已下架</p>
                  <p class="text-label-md text-gold-patina">今日阅读 {{ item.readMinutes }} 分钟</p>
                </div>
              </div>
              <p v-if="item.content" class="mt-md text-body-sm text-ink-secondary leading-relaxed">{{ item.content }}</p>
            </template>

            <!-- 图文动态 -->
            <template v-if="item.kind === 'text'">
              <p class="mt-md text-body-md text-ink-primary leading-relaxed whitespace-pre-wrap">{{ item.content }}</p>
              <div v-if="item.images?.length" class="mt-sm grid grid-cols-2 gap-sm">
                <div v-for="(img, i) in item.images" :key="i" class="aspect-square overflow-hidden rounded border border-hairline bg-paper-warm">
                  <img :src="img" :alt="`配图 ${i + 1}`" class="h-full w-full object-cover" loading="lazy" />
                </div>
              </div>
              <p v-if="item.location" class="mt-sm text-label-md text-ink-muted">📍 {{ item.location }}</p>
            </template>

            <!-- 书评 -->
            <RouterLink v-if="item.kind === 'review'" :to="`/reviews/${item.id}`" class="mt-md block rounded border border-hairline bg-paper-warm p-sm transition-colors hover:border-pine-deep">
              <div class="flex items-center gap-sm">
                <Stars :value="item.rating || 0" :size="14" />
                <span class="text-label-md text-ink-muted">{{ item.rating?.toFixed(1) }}</span>
              </div>
              <p class="mt-0.5 truncate text-body-md text-ink-primary font-medium">{{ item.title || '书评' }}</p>
              <p class="mt-0.5 line-clamp-2 text-body-sm text-ink-secondary">{{ item.content }}</p>
            </RouterLink>

            <!-- 书单 -->
            <RouterLink v-if="item.kind === 'booklist'" :to="`/booklists/${item.id}`" class="mt-md flex items-center gap-sm rounded border border-hairline bg-paper-warm p-sm transition-colors hover:border-pine-deep">
              <div class="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep">
                <span class="text-label-md">{{ item.title?.charAt(0) }}</span>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-xs">
                  <p class="truncate text-body-md text-ink-primary font-medium">{{ item.title }}</p>
                  <span v-if="item.isOfficial" class="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-label-sm text-gold-patina">官方</span>
                </div>
                <p v-if="item.content" class="line-clamp-2 text-body-sm text-ink-secondary">{{ item.content }}</p>
                <p class="text-label-md text-ink-muted">{{ item.itemCount }} 本 · {{ item.collectCount }} 人收藏</p>
              </div>
            </RouterLink>

            <!-- 操作行 -->
            <div class="mt-md flex items-center gap-lg border-t border-hairline pt-md">
              <button
                v-if="item.kind !== 'booklist'"
                type="button"
                class="flex items-center gap-xs text-label-md transition-colors"
                :class="item.isLiked ? 'text-pine-deep' : 'text-ink-muted hover:text-pine-deep'"
                @click="toggleLike(item)"
              >
                <svg :width="16" :height="16" viewBox="0 0 24 24" class="shrink-0">
                  <path
                    :class="item.isLiked ? 'fill-pine-deep stroke-pine-deep' : 'fill-none stroke-current'"
                    stroke-width="1.8"
                    d="M12 20.8l-1.25-1.14C6.4 15.9 3.5 13.22 3.5 9.9c0-2.87 2.28-5.15 5.15-5.15 1.63 0 3.19.76 4.19 1.96l.16.2.16-.2c1-.93 2.56-1.69 4.19-1.69 2.87 0 5.15 2.28 5.15 5.15 0 3.32-2.9 6-7.25 9.76L12 20.8z"
                  />
                </svg>
                {{ item.likeCount || '' }}
              </button>
              <span v-else class="text-label-md text-ink-muted">收藏 {{ item.collectCount || 0 }}</span>
              <span class="text-label-md text-ink-faint">{{ item.commentCount || 0 }} 评论</span>
              <div class="ml-auto flex items-center gap-lg">
                <button
                  type="button"
                  class="text-label-md text-ink-muted transition-colors hover:text-pine-deep"
                  @click="openReport(item)"
                >
                  举报
                </button>
                <RouterLink
                  v-if="item.kind === 'review'"
                  :to="`/reviews/${item.id}`"
                  class="text-label-md text-ink-muted hover:text-pine-deep"
                >
                  查看 →
                </RouterLink>
              </div>
            </div>
          </article>
        </div>

        <div v-else-if="error" class="py-xl text-center">
          <p class="text-body-md text-danger">{{ error }}</p>
          <BaseButton variant="ghost" class="mt-md" @click="load(true)">重试</BaseButton>
        </div>
        <div v-else class="py-xl">
          <BaseEmpty title="暂无动态" description="成为第一个分享的人吧" />
        </div>

        <div v-if="hasMore" class="text-center">
          <BaseButton variant="ghost" :disabled="loading" @click="loadMore">
            {{ loading ? '加载中…' : '加载更多' }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 打卡弹窗 -->
    <BaseModal :open="checkinOpen" title="阅读打卡" @close="checkinOpen = false">
      <form class="space-y-md" @submit.prevent="submitCheckin">
        <div class="rounded border border-hairline bg-paper-warm p-sm text-body-sm text-ink-muted">
          关联今日已完成的阅读场次，每日一次。今日已读 {{ today?.todayMinutes || 0 }} 分钟。
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">图书 ID *</label>
          <BaseInput v-model="checkinForm.bookId" inputmode="numeric" placeholder="输入图书 ID（如 12）" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">打卡感言（选填）</label>
          <BaseTextarea v-model="checkinForm.content" :rows="3" placeholder="今天读了什么？有什么收获？" />
        </div>
        <p v-if="checkinErr" class="text-body-sm text-danger">{{ checkinErr }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="checkinOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="checking">{{ checking ? '打卡中…' : '确认打卡' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- 发图文弹窗 -->
    <BaseModal :open="composeOpen" title="发布动态" @close="composeOpen = false">
      <form class="space-y-md" @submit.prevent="submitCompose">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">内容 *</label>
          <BaseTextarea v-model="composeForm.content" :rows="4" placeholder="分享你的阅读想法…" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">配图</label>
          <div class="flex gap-sm">
            <BaseInput v-model="composeForm.imageUrl" placeholder="图片 URL（最多 9 张）" @keyup.enter.prevent="addImage" />
            <BaseButton variant="ghost" type="button" @click="addImage">添加</BaseButton>
          </div>
          <div v-if="composeImages.length" class="flex gap-sm">
            <div v-for="(img, i) in composeImages" :key="i" class="relative h-14 w-14 overflow-hidden rounded border border-hairline bg-paper-warm">
              <img :src="img" :alt="`配图 ${i + 1}`" class="h-full w-full object-cover" />
              <button type="button" class="absolute right-0 top-0 h-5 w-5 rounded-bl bg-black/50 text-label-sm text-white" @click="composeImages.splice(i, 1)">×</button>
            </div>
          </div>
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">定位（选填）</label>
          <BaseInput v-model="composeForm.location" placeholder="如：北京 · 三联韬奋书店" />
        </div>
        <div v-if="topics.length" class="space-y-2xs">
          <label class="text-label-md text-ink-muted">加入话题（选填）</label>
          <select
            v-model="composeForm.topicId"
            class="w-full rounded border border-hairline bg-paper-elevated px-sm py-1.5 text-body-md text-ink-primary"
          >
            <option value="">不加入话题</option>
            <option v-for="tp in topics" :key="tp.id" :value="String(tp.id)">#{{ tp.title }}</option>
          </select>
        </div>
        <p v-if="composeErr" class="text-body-sm text-danger">{{ composeErr }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="composeOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="posting">{{ posting ? '发布中…' : '发布' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- 举报弹窗 -->
    <ReportDialog
      :open="reportOpen"
      :target-type="reportTarget.type"
      :target-id="reportTarget.id"
      :target-label="reportTarget.label"
      @close="reportOpen = false"
    />
  </main>
</template>