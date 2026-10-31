<script setup lang="ts">
import { ref, computed } from 'vue'
import { BaseButton, BaseModal, BaseInput } from '@/components/base'
import type { GoalItem, StreakInfo } from '@/api/incentive'

const props = defineProps<{
  goals: GoalItem[]
  streak: StreakInfo | null
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', data: { goalType: 'yearly' | 'monthly'; targetMinutes: number; targetBooks: number }): void
  (e: 'update', id: number, data: { targetMinutes: number; targetBooks: number }): void
  (e: 'refresh'): void
}>()

const showSetModal = ref(false)
const editingGoal = ref<{ type: 'yearly' | 'monthly'; id?: number; targetMinutes: number; targetBooks: number }>({
  type: 'yearly',
  targetMinutes: 0,
  targetBooks: 0,
})

const yearlyGoal = computed(() => props.goals.find((g) => g.goalType === 'yearly'))
const monthlyGoal = computed(() => props.goals.find((g) => g.goalType === 'monthly'))

function openSetModal(type: 'yearly' | 'monthly') {
  const existing = type === 'yearly' ? yearlyGoal.value : monthlyGoal.value
  editingGoal.value = {
    type,
    id: existing?.id,
    targetMinutes: existing?.targetMinutes ?? 0,
    targetBooks: existing?.targetBooks ?? 0,
  }
  showSetModal.value = true
}

// 数字输入框清空时会得到空串，统一归一化为非负整数再提交
function toCount(v: number | string): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

function submitGoal() {
  const g = editingGoal.value
  const targetMinutes = toCount(g.targetMinutes)
  const targetBooks = toCount(g.targetBooks)
  if (targetMinutes <= 0 && targetBooks <= 0) return
  if (g.id) {
    emit('update', g.id, { targetMinutes, targetBooks })
  } else {
    emit('create', { goalType: g.type, targetMinutes, targetBooks })
  }
  showSetModal.value = false
}

function formatMinutes(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h${m}m` : `${h}h`
  }
  return `${min}m`
}

function progressPercent(progress: number): number {
  return Math.round(progress * 100)
}

function periodLabel(period: string, type: string): string {
  if (type === 'yearly') return `${period} 年`
  const [y, m] = period.split('-')
  return `${y}年${Number(m)}月`
}
</script>

<template>
  <div class="space-y-md">
    <!-- 连击信息 -->
    <div v-if="streak" class="flex items-center gap-lg rounded-lg bg-gold-tint border border-hairline p-md">
      <div class="flex items-center gap-sm">
        <span class="text-2xl">🔥</span>
        <div>
          <p class="text-label-sm text-ink-muted">连续阅读</p>
          <p class="text-title-lg font-serif tabular-nums text-gold-patina">{{ streak.currentStreak }} 天</p>
        </div>
      </div>
      <div class="h-8 w-px bg-hairline"></div>
      <div class="flex items-center gap-sm">
        <span class="text-2xl">🏆</span>
        <div>
          <p class="text-label-sm text-ink-muted">最长连击</p>
          <p class="text-title-lg font-serif tabular-nums text-pine-deep">{{ streak.longestStreak }} 天</p>
        </div>
      </div>
    </div>

    <!-- 年度目标 -->
    <div class="rounded-lg bg-paper-elevated border border-hairline p-lg shadow-level-1">
      <div class="flex items-center justify-between mb-md">
        <h3 class="text-title-lg text-ink-primary font-serif">年度目标</h3>
        <BaseButton variant="text" @click="openSetModal('yearly')">
          {{ yearlyGoal ? '编辑' : '设定' }}
        </BaseButton>
      </div>

      <div v-if="yearlyGoal" class="space-y-md">
        <div v-if="yearlyGoal.targetMinutes > 0">
          <div class="flex items-center justify-between mb-2xs">
            <span class="text-body-sm text-ink-secondary">阅读时长</span>
            <span class="text-body-sm tabular-nums text-ink-primary">
              {{ formatMinutes(yearlyGoal.actualMinutes) }} / {{ formatMinutes(yearlyGoal.targetMinutes) }}
            </span>
          </div>
          <div class="h-2 rounded-full bg-paper-warm overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="yearlyGoal.minuteProgress >= 1 ? 'bg-gold-patina' : 'bg-pine-deep'"
              :style="{ width: `${progressPercent(yearlyGoal.minuteProgress)}%` }"
            />
          </div>
        </div>

        <div v-if="yearlyGoal.targetBooks > 0">
          <div class="flex items-center justify-between mb-2xs">
            <span class="text-body-sm text-ink-secondary">读完本数</span>
            <span class="text-body-sm tabular-nums text-ink-primary">
              {{ yearlyGoal.actualBooks }} / {{ yearlyGoal.targetBooks }} 本
            </span>
          </div>
          <div class="h-2 rounded-full bg-paper-warm overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="yearlyGoal.bookProgress >= 1 ? 'bg-gold-patina' : 'bg-pine-deep'"
              :style="{ width: `${progressPercent(yearlyGoal.bookProgress)}%` }"
            />
          </div>
        </div>

        <div v-if="yearlyGoal.achieved" class="flex items-center gap-xs text-gold-patina">
          <span>🎉</span>
          <span class="text-body-sm font-medium">年度目标已达成！</span>
        </div>
      </div>

      <div v-else class="py-md text-center">
        <p class="text-body-sm text-ink-muted">尚未设定年度阅读目标</p>
        <BaseButton variant="ghost" class="mt-sm" @click="openSetModal('yearly')">设定目标</BaseButton>
      </div>
    </div>

    <!-- 月度目标 -->
    <div class="rounded-lg bg-paper-elevated border border-hairline p-lg shadow-level-1">
      <div class="flex items-center justify-between mb-md">
        <h3 class="text-title-lg text-ink-primary font-serif">月度目标</h3>
        <BaseButton variant="text" @click="openSetModal('monthly')">
          {{ monthlyGoal ? '编辑' : '设定' }}
        </BaseButton>
      </div>

      <div v-if="monthlyGoal" class="space-y-md">
        <div v-if="monthlyGoal.targetMinutes > 0">
          <div class="flex items-center justify-between mb-2xs">
            <span class="text-body-sm text-ink-secondary">阅读时长</span>
            <span class="text-body-sm tabular-nums text-ink-primary">
              {{ formatMinutes(monthlyGoal.actualMinutes) }} / {{ formatMinutes(monthlyGoal.targetMinutes) }}
            </span>
          </div>
          <div class="h-2 rounded-full bg-paper-warm overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="monthlyGoal.minuteProgress >= 1 ? 'bg-gold-patina' : 'bg-pine-deep'"
              :style="{ width: `${progressPercent(monthlyGoal.minuteProgress)}%` }"
            />
          </div>
        </div>

        <div v-if="monthlyGoal.targetBooks > 0">
          <div class="flex items-center justify-between mb-2xs">
            <span class="text-body-sm text-ink-secondary">读完本数</span>
            <span class="text-body-sm tabular-nums text-ink-primary">
              {{ monthlyGoal.actualBooks }} / {{ monthlyGoal.targetBooks }} 本
            </span>
          </div>
          <div class="h-2 rounded-full bg-paper-warm overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="monthlyGoal.bookProgress >= 1 ? 'bg-gold-patina' : 'bg-pine-deep'"
              :style="{ width: `${progressPercent(monthlyGoal.bookProgress)}%` }"
            />
          </div>
        </div>

        <div v-if="monthlyGoal.achieved" class="flex items-center gap-xs text-gold-patina">
          <span>🎉</span>
          <span class="text-body-sm font-medium">月度目标已达成！</span>
        </div>
      </div>

      <div v-else class="py-md text-center">
        <p class="text-body-sm text-ink-muted">尚未设定月度阅读目标</p>
        <BaseButton variant="ghost" class="mt-sm" @click="openSetModal('monthly')">设定目标</BaseButton>
      </div>
    </div>

    <!-- 设定/编辑弹窗 -->
    <BaseModal :open="showSetModal" :title="editingGoal.id ? '编辑阅读目标' : '设定阅读目标'" @close="showSetModal = false">
      <form class="space-y-md" @submit.prevent="submitGoal">
        <div class="rounded-lg bg-pine-subtle px-md py-sm text-body-sm text-pine-deep">
          {{ editingGoal.type === 'yearly' ? '年度目标' : '月度目标' }} ·
          {{ editingGoal.type === 'yearly' ? new Date().getFullYear() + ' 年' : new Date().getFullYear() + '年' + (new Date().getMonth() + 1) + '月' }}
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">目标时长（分钟）</label>
          <BaseInput
            v-model="editingGoal.targetMinutes"
            type="number"
            placeholder="如 6000（即 100 小时）"
          />
          <p class="text-label-sm text-ink-faint">
            {{ editingGoal.targetMinutes > 0 ? formatMinutes(editingGoal.targetMinutes) : '设为 0 表示不跟踪时长目标' }}
          </p>
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">目标读完本数</label>
          <BaseInput
            v-model="editingGoal.targetBooks"
            type="number"
            placeholder="如 24"
          />
          <p class="text-label-sm text-ink-faint">设为 0 表示不跟踪本数目标</p>
        </div>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="showSetModal = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit">保存</BaseButton>
        </div>
      </form>
    </BaseModal>
  </div>
</template>
