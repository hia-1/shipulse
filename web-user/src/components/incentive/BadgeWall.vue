<script setup lang="ts">
import { ref, computed } from 'vue'
import { BaseEmpty } from '@/components/base'
import type { BadgeItem } from '@/api/incentive'

const props = defineProps<{
  badges: BadgeItem[]
  loading?: boolean
}>()

const activeCategory = ref<string>('all')

const categories = [
  { key: 'all', label: '全部' },
  { key: 'streak', label: '连击' },
  { key: 'goal', label: '目标' },
  { key: 'social', label: '社区' },
  { key: 'special', label: '特殊' },
]

const filteredBadges = computed(() => {
  if (activeCategory.value === 'all') return props.badges
  return props.badges.filter((b) => b.category === activeCategory.value)
})

const unlockedCount = computed(() => props.badges.filter((b) => b.unlocked).length)

const CATEGORY_ICONS: Record<string, string> = {
  streak: '🔥',
  goal: '🎯',
  social: '💬',
  special: '⭐',
}

function badgeIcon(badge: BadgeItem): string {
  if (badge.iconUrl) return badge.iconUrl
  return CATEGORY_ICONS[badge.category] ?? '🏅'
}

function progressPercent(progress: number | null): number {
  if (progress === null) return 0
  return Math.round(progress * 100)
}
</script>

<template>
  <div>
    <!-- 统计 -->
    <div class="mb-md flex items-center justify-between">
      <p class="text-body-sm text-ink-muted">
        已解锁 <span class="tabular-nums text-pine-deep font-medium">{{ unlockedCount }}</span>
        / {{ badges.length }} 枚徽章
      </p>
    </div>

    <!-- 分类筛选 -->
    <div class="mb-md flex gap-xs flex-wrap">
      <button
        v-for="cat in categories"
        :key="cat.key"
        type="button"
        class="rounded px-md py-[2px] text-label-md transition-all"
        :class="
          activeCategory === cat.key
            ? 'bg-pine-subtle border border-pine-deep text-pine-deep font-medium'
            : 'border border-hairline text-ink-secondary hover:border-border-muted'
        "
        @click="activeCategory = cat.key"
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- 徽章网格 -->
    <div v-if="filteredBadges.length === 0" class="py-lg">
      <BaseEmpty title="暂无徽章" description="徽章即将上线" />
    </div>

    <div v-else class="grid grid-cols-3 gap-sm sm:grid-cols-4">
      <div
        v-for="badge in filteredBadges"
        :key="badge.id"
        class="flex flex-col items-center rounded-lg border p-sm text-center transition-all"
        :class="
          badge.unlocked
            ? 'bg-gold-tint border-gold-patina/30 shadow-level-1'
            : 'bg-paper-warm border-hairline opacity-70'
        "
      >
        <div
          class="mb-2xs flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          :class="badge.unlocked ? 'bg-gold-patina/20' : 'bg-paper-elevated grayscale'"
        >
          {{ badgeIcon(badge) }}
        </div>

        <p
          class="text-label-md font-medium truncate w-full"
          :class="badge.unlocked ? 'text-ink-primary' : 'text-ink-muted'"
        >
          {{ badge.name }}
        </p>

        <p class="text-label-sm text-ink-faint mt-2xs line-clamp-2 min-h-[2em]">
          {{ badge.description || badge.code }}
        </p>

        <!-- 已解锁：显示解锁时间 -->
        <p v-if="badge.unlocked && badge.unlockedAt" class="text-label-sm text-gold-patina mt-2xs">
          {{ new Date(badge.unlockedAt).toLocaleDateString('zh-CN') }}
        </p>

        <!-- 未解锁：显示进度条 -->
        <div v-else-if="badge.progress !== null && badge.progress > 0" class="mt-2xs w-full">
          <div class="h-1.5 rounded-full bg-paper-elevated overflow-hidden">
            <div
              class="h-full rounded-full bg-pine-deep transition-all duration-500"
              :style="{ width: `${progressPercent(badge.progress)}%` }"
            />
          </div>
          <p class="text-label-sm text-ink-faint mt-2xs">{{ progressPercent(badge.progress) }}%</p>
        </div>

        <div v-else class="mt-2xs">
          <span class="text-label-sm text-ink-faint">🔒</span>
        </div>
      </div>
    </div>
  </div>
</template>
