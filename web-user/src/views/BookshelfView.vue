<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/composables/useToast'
import { BaseEmpty, BaseButton } from '@/components/base'
import ShelfBookCard from '@/components/bookshelf/ShelfBookCard.vue'
import {
  fetchMyShelf,
  setShelfStatus,
  removeFromShelf,
  type ShelfBook,
  type ShelfStatus,
} from '@/api/bookshelf'

const router = useRouter()
const userStore = useUserStore()

type TabKey = 'want' | 'reading' | 'read'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'want', label: '想读' },
  { key: 'reading', label: '在读' },
  { key: 'read', label: '已读' },
]

const activeTab = ref<TabKey>('reading')
const list = ref<ShelfBook[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const counts = ref<Record<TabKey, number>>({
  want: 0,
  reading: 0,
  read: 0,
})

async function loadList() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchMyShelf(1, 50, activeTab.value)
    list.value = res.data.list
    total.value = res.data.total
    counts.value[activeTab.value] = res.data.total
  } catch (e) {
    error.value = (e as Error).message
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadCounts() {
  for (const tab of tabs) {
    try {
      const res = await fetchMyShelf(1, 1, tab.key)
      counts.value[tab.key] = res.data.total
    } catch {
      /* ignore */
    }
  }
}

async function handleSwitchStatus(bookId: number, status: Exclude<ShelfStatus, null>) {
  try {
    await setShelfStatus(bookId, status)
    await loadList()
    await loadCounts()
  } catch (e) {
    showToast((e as Error).message || '操作失败，请稍后重试', 'error')
  }
}

async function handleRemove(bookId: number) {
  try {
    await removeFromShelf(bookId)
    await loadList()
    await loadCounts()
  } catch (e) {
    showToast((e as Error).message || '操作失败，请稍后重试', 'error')
  }
}

async function retryLoad() {
  await Promise.all([loadList(), loadCounts()])
}

function goBookstore() {
  router.push('/books')
}

watch(activeTab, () => loadList())

onMounted(async () => {
  await userStore.restore()
  await Promise.all([loadList(), loadCounts()])
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <!-- 页头 -->
      <div class="mb-lg flex items-center justify-between">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">我的书架</h1>
        <BaseButton variant="ghost" @click="goBookstore">去书城找书</BaseButton>
      </div>

      <!-- 三态 Tab -->
      <div class="mb-lg flex gap-xs rounded-lg bg-paper-elevated border border-hairline p-xs shadow-level-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="flex-1 rounded px-lg py-sm text-body-md transition-all"
          :class="
            activeTab === tab.key
              ? 'bg-pine-deep text-paper-elevated font-medium shadow-level-1'
              : 'text-ink-secondary hover:bg-paper-warm'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <span
            class="ml-xs text-label-sm tabular-nums"
            :class="activeTab === tab.key ? 'text-paper-elevated/70' : 'text-ink-faint'"
          >
            {{ counts[tab.key] }}
          </span>
        </button>
      </div>

      <!-- 加载中 -->
      <div v-if="loading" class="py-xl text-center text-body-md text-ink-muted">加载中…</div>

      <!-- 加载失败 -->
      <div v-else-if="error" class="py-xl text-center">
        <p class="text-body-md text-danger">{{ error }}</p>
        <BaseButton variant="ghost" class="mt-md" @click="retryLoad">重试</BaseButton>
      </div>

      <!-- 列表 -->
      <div v-else-if="list.length > 0" class="space-y-md">
        <ShelfBookCard
          v-for="item in list"
          :key="item.id"
          :item="item"
          @remove="handleRemove"
          @switch-status="handleSwitchStatus"
        />

        <!-- 分页提示 -->
        <div v-if="total > list.length" class="pt-md text-center text-label-sm text-ink-faint">
          共 {{ total }} 本，当前显示 {{ list.length }} 本
        </div>
      </div>

      <!-- 空书架引导 -->
      <BaseEmpty
        v-else
        title="书架还是空的"
        description="去书城发现你的下一本好书吧"
      >
        <template #icon>📚</template>
        <template #action>
          <BaseButton variant="primary" @click="goBookstore">去找书</BaseButton>
        </template>
      </BaseEmpty>
    </div>
  </main>
</template>
