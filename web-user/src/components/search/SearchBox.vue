<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { fetchSuggest, fetchHot, recordSearch, type SuggestResult } from '@/api/search'
import { getHistory, addHistory, clearHistory } from '@/composables/useSearchHistory'
import type { BookItem } from '@/api/library'

/**
 * 搜索框（DESIGN.md Components > Input Fields）
 * 聚焦/输入时弹出下拉：空态展示「历史 + 热搜」，输入后展示「联想 + ISBN 直达」。
 * 选中/回车 → 记录历史与热词，并 emit submit(keyword) 交由父级导航。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    autofocus?: boolean
  }>(),
  { placeholder: '搜索书名 / 作者 / ISBN', autofocus: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [keyword: string]
}>()

const focused = ref(false)
const suggestions = ref<BookItem[]>([])
const isbnHit = ref<BookItem | null>(null)
const hotList = ref<{ keyword: string; count: number }[]>([])
const history = ref<string[]>([])
const loadingSuggest = ref(false)
let suggestTimer: number | undefined

// 输入关键词（防抖 180ms → 联想）
watch(
  () => props.modelValue,
  (val) => {
    window.clearTimeout(suggestTimer)
    const k = val.trim()
    if (!k) {
      suggestions.value = []
      isbnHit.value = null
      return
    }
    loadingSuggest.value = true
    suggestTimer = window.setTimeout(async () => {
      try {
        const res = await fetchSuggest(k, 8)
        const data = res.data as SuggestResult
        suggestions.value = data.books
        isbnHit.value = data.isbnHit
      } catch {
        suggestions.value = []
        isbnHit.value = null
      } finally {
        loadingSuggest.value = false
      }
    }, 180)
  },
)

async function loadPanelData() {
  history.value = getHistory()
  try {
    const res = await fetchHot(10)
    hotList.value = res.data
  } catch {
    hotList.value = []
  }
}

function onFocus() {
  focused.value = true
  void loadPanelData()
}

function select(keyword: string) {
  emit('update:modelValue', keyword)
  history.value = addHistory(keyword)
  void recordSearch(keyword).catch(() => undefined)
  emit('submit', keyword)
  focused.value = false
}

function onBlurDelay() {
  window.setTimeout(() => (focused.value = false), 150)
}

function clearQuery() {
  emit('update:modelValue', '')
}

function onEnter() {
  const k = props.modelValue.trim()
  if (k) select(k)
}

function onClearHistory() {
  clearHistory()
  history.value = []
}

function onClearInput() {
  emit('update:modelValue', '')
  suggestions.value = []
  isbnHit.value = null
}

onMounted(() => {
  if (props.autofocus) focused.value = true
})
</script>

<template>
  <div class="relative">
    <div class="flex items-center gap-xs rounded border border-hairline bg-paper-elevated px-sm focus-within:border-pine-deep focus-within:ring-[3px] focus-within:ring-pine-deep/[0.08]">
      <svg class="h-4 w-4 flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        :value="modelValue"
        :placeholder="placeholder === undefined ? undefined : placeholder"
        class="h-10 w-full bg-transparent text-body-md text-ink-primary placeholder:text-ink-muted focus:outline-none"
        @focus="onFocus"
        @blur="onBlurDelay"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="onEnter"
      />
      <button v-if="modelValue" type="button" class="text-ink-faint hover:text-ink-muted" @click="onClearInput">
        ✕
      </button>
    </div>

    <!-- 下拉面板 -->
    <div
      v-if="focused && (modelValue.trim() || history.length || hotList.length || suggestions.length || isbnHit)"
      class="absolute left-0 right-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-lg border border-hairline bg-paper-elevated shadow-level-2"
    >
      <!-- 输入态：ISBN 直达 -->
      <div v-if="isbnHit" class="border-b border-hairline p-sm">
        <RouterLink
          :to="`/books/${isbnHit.id}`"
          class="flex items-center gap-sm rounded p-xs transition-colors hover:bg-paper-warm"
          @click="focused = false"
        >
          <img v-if="isbnHit.coverUrl" :src="isbnHit.coverUrl" class="h-12 w-9 flex-none rounded-sm object-cover" alt="" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-title-md text-pine-deep">ISBN 精确匹配</p>
            <p class="truncate text-body-sm text-ink-secondary">{{ isbnHit.title }} · {{ isbnHit.author }}</p>
          </div>
          <span class="text-label-sm text-ink-faint">直达 →</span>
        </RouterLink>
      </div>

      <!-- 输入态：书名联想 -->
      <template v-if="modelValue.trim()">
        <p v-if="loadingSuggest" class="px-sm py-md text-center text-label-sm text-ink-muted">联想中…</p>
        <div v-else-if="suggestions.length" class="p-2xs">
          <button
            v-for="b in suggestions"
            :key="b.id"
            type="button"
            class="flex w-full items-center gap-sm rounded p-xs text-left transition-colors hover:bg-paper-warm"
            @click="select(b.title)"
          >
            <img v-if="b.coverUrl" :src="b.coverUrl" class="h-12 w-9 flex-none rounded-sm object-cover" alt="" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-body-md text-ink-primary">{{ b.title }}</p>
              <p class="truncate text-body-sm text-ink-muted">{{ b.author }}</p>
            </div>
          </button>
        </div>
        <p v-else class="px-sm py-md text-center text-label-sm text-ink-muted">无匹配，回车搜索「{{ modelValue.trim() }}」</p>
      </template>

      <!-- 空态：搜索历史 + 热搜 -->
      <template v-else>
        <div v-if="history.length" class="p-sm">
          <div class="mb-xs flex items-center justify-between">
            <span class="text-label-sm text-ink-muted">搜索历史</span>
            <button type="button" class="text-label-sm text-ink-faint hover:text-ink-muted" @click="onClearHistory">
              清空
            </button>
          </div>
          <div class="flex flex-wrap gap-2xs">
            <button
              v-for="kw in history"
              :key="kw"
              type="button"
              class="rounded border border-hairline bg-paper-warm px-xs py-2xs text-body-sm text-ink-secondary transition-colors hover:border-border-muted"
              @click="select(kw)"
            >
              {{ kw }}
            </button>
          </div>
        </div>

        <div v-if="hotList.length" class="border-t border-hairline p-sm">
          <span class="mb-2xs block text-label-sm text-ink-muted">🔥 热搜</span>
          <div class="flex flex-wrap gap-2xs">
            <button
              v-for="h in hotList"
              :key="h.keyword"
              type="button"
              class="rounded border border-hairline bg-paper-warm px-xs py-2xs text-body-sm text-ink-secondary transition-colors hover:border-border-muted"
              @click="select(h.keyword)"
            >
              {{ h.keyword }}
              <span class="ml-1 text-label-sm text-ink-faint">{{ h.count }}</span>
            </button>
          </div>
        </div>

        <p v-if="!history.length && !hotList.length" class="px-sm py-md text-center text-label-sm text-ink-muted">
          输入书名 / 作者 / ISBN 开始搜索
        </p>
      </template>
    </div>
  </div>
</template>