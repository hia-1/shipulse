<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import {
  fetchShelfStatus,
  setShelfStatus,
  removeFromShelf,
  type ShelfStatus,
} from '@/api/bookshelf'

/**
 * 书架三态操作组件：想读 / 在读 / 已读（互斥切换）。
 * - 点击非当前态 → 切到该态（即时更新书架）
 * - 点击当前态 → 移出书架（切换关）
 * - 未登录点击 → 引导去登录（带 redirect 回跳）
 * 变更成功后 emit('changed', newStatus)，父级据此刷新计数。
 */
const props = defineProps<{ bookId: number }>()
const emit = defineEmits<{ changed: [status: ShelfStatus] }>()

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const current = ref<ShelfStatus>(null)
const loading = ref(false)
const ready = ref(false)

const states: { key: Exclude<ShelfStatus, null>; label: string; tip: string }[] = [
  { key: 'want', label: '想读', tip: '标记为想读，稍后开始阅读' },
  { key: 'reading', label: '在读', tip: '正在阅读这本书' },
  { key: 'read', label: '已读', tip: '已经读完这本书' },
]

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    ready.value = true
    return
  }
  try {
    const res = await fetchShelfStatus(props.bookId)
    current.value = res.data.status
  } catch {
    /* 未登录/出错保持未加书架 */
  } finally {
    ready.value = true
  }
})

async function pick(key: Exclude<ShelfStatus, null>) {
  if (loading.value || !ready.value) return
  if (!userStore.isLoggedIn) {
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  loading.value = true
  try {
    let next: ShelfStatus
    if (current.value === key) {
      await removeFromShelf(props.bookId)
      next = null
    } else {
      const res = await setShelfStatus(props.bookId, key)
      next = res.data.status
    }
    current.value = next
    emit('changed', next)
  } catch (e) {
    // 失败保持原态，父级可提示
  } finally {
    loading.value = false
  }
}

const activeKey = computed(() => current.value)
</script>

<template>
  <div class="flex gap-xs" role="group" aria-label="书架状态">
    <button
      v-for="s in states"
      :key="s.key"
      type="button"
      class="flex-1 rounded border py-[3px] px-sm text-body-sm transition-all"
      :class="
        activeKey === s.key
          ? 'border-pine-deep bg-pine-subtle text-pine-deep font-medium shadow-level-1'
          : 'border-hairline bg-paper-elevated text-ink-secondary hover:border-border-muted hover:bg-paper-warm'
      "
      :title="s.tip"
      :disabled="loading || !ready"
      @click="pick(s.key)"
    >
      {{ loading ? '处理中…' : s.label }}
    </button>
  </div>
</template>