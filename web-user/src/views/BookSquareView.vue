<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/composables/useToast'
import { BaseButton, BaseModal, BaseInput, BaseTextarea } from '@/components/base'
import {
  listSquare,
  createBooklist,
  collectBooklist,
  uncollectBooklist,
  type BooklistCard,
  type SquareResult,
} from '@/api/booklist'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const error = ref('')
const list = ref<BooklistCard[]>([])
const total = ref(0)
const tags = ref<string[]>([])
const sort = ref<'hot' | 'newest'>('hot')
const tag = ref('')
const q = ref('')
const keyword = ref('')
const page = ref(1)
const PAGE_SIZE = 10

// 创建弹窗
const createOpen = ref(false)
const form = ref({ title: '', description: '', coverUrl: '' })
const creating = ref(false)
const createError = ref('')

async function load(reset = true) {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const p = reset ? 1 : page.value + 1
    const res: SquareResult = (
      await listSquare({
        tag: tag.value || undefined,
        q: q.value || undefined,
        sort: sort.value,
        page: p,
        pageSize: PAGE_SIZE,
      })
    ).data
    list.value = reset ? res.list : [...list.value, ...res.list]
    total.value = res.total
    page.value = p
    if (res.tags.length) tags.value = res.tags
  } catch (e) {
    const msg = (e as Error).message || '加载失败，请稍后重试'
    if (reset) error.value = msg
    else showToast(msg, 'error')
  } finally {
    loading.value = false
  }
}

function hasMore() {
  return list.value.length < total.value
}

function switchSort(s: 'hot' | 'newest') {
  if (sort.value === s) return
  sort.value = s
  load(true)
}

function switchTag(t: string) {
  const next = tag.value === t ? '' : t
  tag.value = next
  load(true)
}

function submitSearch() {
  q.value = keyword.value.trim()
  load(true)
}

function openCreate() {
  createError.value = ''
  createOpen.value = true
}

async function submitCreate() {
  if (!form.value.title.trim()) {
    createError.value = '请填写书单标题'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const res = await createBooklist({
      title: form.value.title.trim(),
      description: form.value.description.trim(),
      coverUrl: form.value.coverUrl.trim(),
    })
    createOpen.value = false
    router.push(`/booklists/${res.data.id}`)
  } catch (e) {
    createError.value = (e as Error).message || '创建失败'
  } finally {
    creating.value = false
  }
}

async function toggleCollect(book: BooklistCard) {
  if (!userStore.isLoggedIn) {
    router.push('/login')
    return
  }
  try {
    if (book.collected) {
      const res = await uncollectBooklist(book.id)
      book.collected = false
      book.collectCount = res.data.collectCount
    } else {
      const res = await collectBooklist(book.id)
      book.collected = res.data.collected
      book.collectCount = res.data.collectCount
    }
  } catch (e) {
    showToast((e as Error).message || '操作失败，请稍后重试', 'error')
  }
}

function formatCount(n: number) {
  return n > 999 ? `${(n / 1000).toFixed(1)}k` : n
}

onMounted(() => load(true))
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <div class="flex items-center justify-between">
          <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">书单广场</h1>
          <BaseButton v-if="userStore.isLoggedIn" variant="ghost" @click="openCreate">+ 创建书单</BaseButton>
        </div>

        <!-- 搜索 + 排序 -->
        <div class="space-y-sm">
          <form class="flex gap-sm" @submit.prevent="submitSearch">
            <BaseInput v-model="keyword" placeholder="搜索书单标题或简介" class="flex-1" />
            <BaseButton variant="ghost" @click="submitSearch">搜索</BaseButton>
          </form>
          <div class="flex gap-sm">
            <button
              v-for="s in ([['hot', '最热'], ['newest', '最新']] as const)"
              :key="s[0]"
              type="button"
              class="rounded-full border px-md py-1 text-label-md transition-colors"
              :class="sort === s[0] ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
              @click="switchSort(s[0])"
            >
              {{ s[1] }}
            </button>
          </div>
        </div>

        <!-- 标签筛选 -->
        <div class="no-scrollbar flex gap-sm overflow-x-auto pb-sm -mx-md px-md">
          <button
            type="button"
            class="shrink-0 rounded-full border px-md py-1 text-label-md transition-colors"
            :class="!tag ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
            @click="switchTag('')"
          >
            全部
          </button>
          <button
            v-for="t in tags"
            :key="t"
            type="button"
            class="shrink-0 rounded-full border px-md py-1 text-label-md transition-colors"
            :class="tag === t ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
            @click="switchTag(t)"
          >
            {{ t }}
          </button>
        </div>

        <!-- 加载中（首次） -->
        <div v-if="loading && !list.length" class="space-y-md">
          <div
            v-for="i in 3"
            :key="i"
            class="h-28 animate-pulse rounded-lg border border-hairline bg-paper-elevated"
          />
        </div>

        <!-- 卡片列表 -->
        <div v-else-if="list.length" class="space-y-md">
          <RouterLink
            v-for="b in list"
            :key="b.id"
            :to="`/booklists/${b.id}`"
            class="block rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep"
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
                <p class="mt-1 text-label-md text-ink-muted">
                  {{ b.creator }} · {{ b.itemCount }} 本
                </p>
              </div>
              <!-- 收藏按钮 -->
              <button
                type="button"
                class="shrink-0 self-center rounded-full border px-sm py-1 text-label-md transition-colors"
                :class="b.collected ? 'border-pine-deep bg-pine-subtle text-pine-deep' : 'border-hairline text-ink-secondary'"
                @click.prevent="toggleCollect(b)"
              >
                {{ b.collected ? '已收藏' : '收藏' }} {{ b.collectCount }}
              </button>
            </div>
          </RouterLink>
        </div>
        <div v-else-if="error" class="py-xl text-center">
          <p class="text-body-md text-danger">{{ error }}</p>
          <BaseButton variant="ghost" class="mt-md" @click="load(true)">重试</BaseButton>
        </div>
        <div v-else class="py-xl text-center text-body-md text-ink-muted">暂无书单，成为第一个策展人吧</div>

        <div v-if="hasMore()" class="text-center">
          <BaseButton variant="ghost" :disabled="loading" @click="load(false)">
            {{ loading ? '加载中…' : '加载更多' }}
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 创建书单弹窗 -->
    <BaseModal :open="createOpen" title="创建书单" @close="createOpen = false">
      <form class="space-y-md" @submit.prevent="submitCreate">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">标题 *</label>
          <BaseInput v-model="form.title" placeholder="如：2026 不容错过的科幻佳作" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">简介</label>
          <BaseTextarea v-model="form.description" placeholder="介绍一下这份书单（选填）" :rows="3" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">封面 URL（选填）</label>
          <BaseInput v-model="form.coverUrl" placeholder="https://…" />
        </div>
        <p v-if="createError" class="text-body-sm text-danger">{{ createError }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="createOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="creating">{{ creating ? '创建中…' : '创建' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </main>
</template>