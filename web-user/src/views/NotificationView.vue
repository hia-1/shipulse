<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton, BaseEmpty } from '@/components/base'
import { showToast } from '@/composables/useToast'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationCategory,
  type NotificationItem,
} from '@/api/notification'
import { useNotificationStore } from '@/stores/notification'

const router = useRouter()
const notiStore = useNotificationStore()

type TabKey = 'all' | NotificationCategory

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'like', label: '点赞' },
  { key: 'comment', label: '评论' },
  { key: 'system', label: '系统' },
]

const activeTab = ref<TabKey>('all')
const items = ref<NotificationItem[]>([])
const total = ref(0)
const page = ref(1)
const PAGE_SIZE = 20
const loading = ref(false)
const loadError = ref('')
const markingAll = ref(false)

const hasMore = computed(() => items.value.length < total.value)

const unreadOf = (tab: TabKey) => {
  if (tab === 'all') return notiStore.unread.total
  return notiStore.unread[tab]
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return d.toLocaleDateString('zh-CN')
}

/** 通知动作文案：点赞/评论拼接触发者，系统消息用标题 */
function actionText(n: NotificationItem) {
  if (n.type === 'like') {
    return n.targetType === 'post' ? '赞了你的动态' : '赞了你的书评'
  }
  if (n.type === 'comment') {
    return n.title || '评论了你的书评'
  }
  return n.title
}

/** 跳转目标：按对象类型映射站内路由，无对应页面则不跳转 */
function targetLink(n: NotificationItem): string | null {
  if (!n.targetId || n.targetId === '0') return null
  switch (n.targetType) {
    case 'review':
      return `/reviews/${n.targetId}`
    case 'booklist':
      return `/booklists/${n.targetId}`
    case 'post':
      return '/feed'
    case 'membership':
      return '/membership'
    default:
      return null
  }
}

async function load(reset = true) {
  const target = reset ? 1 : page.value + 1
  loading.value = true
  if (reset) loadError.value = ''
  try {
    const res = await listNotifications({
      type: activeTab.value,
      page: target,
      pageSize: PAGE_SIZE,
    })
    items.value = reset ? res.data.list : [...items.value, ...res.data.list]
    total.value = res.data.total
    page.value = target
  } catch (e) {
    if (reset) loadError.value = (e as Error).message || '消息加载失败'
    else showToast((e as Error).message || '加载失败', 'error')
  } finally {
    loading.value = false
  }
}

function switchTab(tab: TabKey) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  items.value = []
  total.value = 0
  load(true)
}

async function openItem(n: NotificationItem) {
  if (!n.isRead) {
    n.isRead = true
    try {
      await markNotificationRead(n.id)
      await notiStore.fetchUnread()
    } catch {
      // 标记失败时回滚本地态，避免与后端不一致
      n.isRead = false
    }
  }
  const link = targetLink(n)
  if (link) router.push(link)
}

async function readAll() {
  if (unreadOf(activeTab.value) === 0) return
  markingAll.value = true
  try {
    await markAllNotificationsRead(activeTab.value)
    items.value = items.value.map((n) => ({ ...n, isRead: true }))
    await notiStore.fetchUnread()
    showToast('已全部标为已读', 'success')
  } catch (e) {
    showToast((e as Error).message || '操作失败', 'error')
  } finally {
    markingAll.value = false
  }
}

onMounted(() => {
  load(true)
  notiStore.fetchUnread()
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="mx-auto max-w-container px-md">
      <div class="mx-auto max-w-md space-y-lg">
        <div class="flex items-center justify-between">
          <h1 class="font-serif text-headline-lg-mobile text-pine-deep md:text-headline-lg">消息中心</h1>
          <BaseButton
            variant="ghost"
            :disabled="markingAll || unreadOf(activeTab) === 0"
            @click="readAll"
          >
            {{ markingAll ? '处理中…' : '全部已读' }}
          </BaseButton>
        </div>

        <!-- 分类 Tab -->
        <div class="grid grid-cols-4 overflow-hidden rounded-lg border border-hairline bg-paper-elevated shadow-level-1">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            class="relative py-md text-body-md transition-colors"
            :class="activeTab === t.key
              ? 'border-b-2 border-pine-deep font-medium text-pine-deep'
              : 'text-ink-muted hover:text-ink-primary'"
            @click="switchTab(t.key)"
          >
            {{ t.label }}
            <span
              v-if="unreadOf(t.key) > 0"
              class="ml-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-label-sm text-paper-elevated"
            >
              {{ unreadOf(t.key) > 99 ? '99+' : unreadOf(t.key) }}
            </span>
          </button>
        </div>

        <!-- 列表 -->
        <div class="overflow-hidden rounded-lg border border-hairline bg-paper-elevated shadow-level-1">
          <div v-if="loadError" class="p-lg text-center">
            <p class="text-body-sm text-danger">{{ loadError }}</p>
            <BaseButton variant="ghost" class="mt-sm" @click="load(true)">重试</BaseButton>
          </div>
          <div v-else-if="loading && items.length === 0" class="py-xl text-center text-body-sm text-ink-muted">加载中…</div>
          <BaseEmpty
            v-else-if="items.length === 0"
            title="暂无消息"
            description="收到点赞、评论或系统通知后会在这里展示"
          />
          <template v-else>
            <ul class="divide-y divide-hairline">
              <li
                v-for="n in items"
                :key="n.id"
                class="cursor-pointer px-lg py-md transition-colors hover:bg-paper-warm"
                :class="!n.isRead ? 'bg-pine-subtle/40' : ''"
                @click="openItem(n)"
              >
                <div class="flex gap-sm">
                  <!-- 头像 / 系统图标 -->
                  <div class="relative shrink-0">
                    <img
                      v-if="n.sender?.avatarUrl"
                      :src="n.sender.avatarUrl"
                      alt=""
                      class="h-10 w-10 rounded-full border border-hairline object-cover"
                    />
                    <div
                      v-else
                      class="flex h-10 w-10 items-center justify-center rounded-full bg-paper-warm text-title-md text-ink-muted"
                    >
                      {{ n.category === 'system' ? '🔔' : (n.sender?.nickname?.charAt(0) || '书') }}
                    </div>
                    <span
                      v-if="!n.isRead"
                      class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-paper-elevated bg-danger"
                    />
                  </div>

                  <div class="min-w-0 flex-1">
                    <p class="text-body-md text-ink-primary">
                      <span v-if="n.sender" class="font-medium">{{ n.sender.nickname }}</span>
                      <span class="text-ink-secondary">{{ actionText(n) }}</span>
                    </p>
                    <p v-if="n.content" class="mt-1 line-clamp-2 text-body-sm text-ink-secondary">{{ n.content }}</p>
                    <p class="mt-1 text-label-sm text-ink-muted">{{ fmtTime(n.createdAt) }}</p>
                  </div>
                </div>
              </li>
            </ul>
            <div v-if="hasMore" class="px-lg pb-lg pt-md">
              <BaseButton variant="ghost" class="w-full" :disabled="loading" @click="load(false)">
                {{ loading ? '加载中…' : '加载更多' }}
              </BaseButton>
            </div>
          </template>
        </div>
      </div>
    </div>
  </main>
</template>