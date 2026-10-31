<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/composables/useToast'
import { BaseButton, BaseEmpty } from '@/components/base'
import PulseHeatmap from '@/components/reading/PulseHeatmap.vue'
import DurationChart from '@/components/reading/DurationChart.vue'
import GoalCard from '@/components/incentive/GoalCard.vue'
import ShareDialog from '@/components/share/ShareDialog.vue'
import {
  getDailyDurations,
  getAnnualReview,
  exportPulseCsv,
  type DailyDuration,
  type AnnualReview,
} from '@/api/reading'
import {
  getGoalProgress,
  createGoal,
  updateGoal,
  checkBadges,
  type GoalItem,
  type StreakInfo,
} from '@/api/incentive'

const userStore = useUserStore()

type ChartTab = 'day' | 'week' | 'month'
const activeTab = ref<ChartTab>('day')

const yearData = ref<DailyDuration[]>([])
const chartData = ref<DailyDuration[]>([])
const annualReview = ref<AnnualReview | null>(null)
const loading = ref(false)
const loadError = ref('')
const exporting = ref(false)
const exportError = ref('')

const goals = ref<GoalItem[]>([])
const streak = ref<StreakInfo | null>(null)
const shareOpen = ref(false)

const tabs: { key: ChartTab; label: string }[] = [
  { key: 'day', label: '日' },
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
]

const currentYear = new Date().getFullYear()

function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

async function loadYearData() {
  const start = new Date(currentYear, 0, 1)
  const end = new Date(currentYear + 1, 0, 1)
  const res = await getDailyDurations(formatDate(start), formatDate(end))
  yearData.value = res.data
}

async function loadChartData() {
  const now = new Date()
  let start: Date
  let end = new Date(now)
  end.setDate(end.getDate() + 1)

  if (activeTab.value === 'day') {
    start = new Date(now)
    start.setDate(start.getDate() - 29)
  } else if (activeTab.value === 'week') {
    start = new Date(now)
    start.setDate(start.getDate() - 83)
  } else {
    start = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  }

  const res = await getDailyDurations(formatDate(start), formatDate(end))
  let data = res.data

  if (activeTab.value === 'week') {
    const weekly: DailyDuration[] = []
    for (let i = 0; i < data.length; i += 7) {
      const chunk = data.slice(i, i + 7)
      const totalSeconds = chunk.reduce((sum, d) => sum + d.seconds, 0)
      const sessionCount = chunk.reduce((sum, d) => sum + d.sessionCount, 0)
      weekly.push({
        date: chunk[0]?.date ?? '',
        seconds: totalSeconds,
        sessionCount,
      })
    }
    data = weekly
  } else if (activeTab.value === 'month') {
    const monthly: DailyDuration[] = []
    let currentMonth = ''
    for (const d of data) {
      const month = d.date.slice(0, 7)
      if (month !== currentMonth) {
        monthly.push({ date: month + '-01', seconds: 0, sessionCount: 0 })
        currentMonth = month
      }
      monthly[monthly.length - 1].seconds += d.seconds
      monthly[monthly.length - 1].sessionCount += d.sessionCount
    }
    data = monthly
  }

  chartData.value = data
}

async function loadAnnualReview() {
  const res = await getAnnualReview(currentYear)
  annualReview.value = res.data
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    await Promise.all([loadYearData(), loadChartData(), loadAnnualReview(), loadGoalProgress()])
  } catch (e) {
    loadError.value = (e as Error).message || '数据加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

async function loadGoalProgress() {
  try {
    const res = await getGoalProgress()
    goals.value = res.data.goals
    streak.value = res.data.streak
  } catch {
    /* ignore */
  }
}

async function handleCreateGoal(data: { goalType: 'yearly' | 'monthly'; targetMinutes: number; targetBooks: number }) {
  try {
    await createGoal(data)
    await loadGoalProgress()
    await checkBadges()
    showToast('目标已设定', 'success')
  } catch (e) {
    showToast((e as Error).message || '目标设定失败，请稍后重试', 'error')
  }
}

async function handleUpdateGoal(id: number, data: { targetMinutes: number; targetBooks: number }) {
  try {
    await updateGoal(id, data)
    await loadGoalProgress()
    await checkBadges()
    showToast('目标已更新', 'success')
  } catch (e) {
    showToast((e as Error).message || '目标更新失败，请稍后重试', 'error')
  }
}

watch(activeTab, () => loadChartData())

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m > 0 ? `${m}m` : ''}`
  return `${m}m`
}

function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN')
}

async function handleExport() {
  exporting.value = true
  exportError.value = ''
  try {
    const res = await exportPulseCsv()
    const blob = new Blob(['\ufeff' + res.data.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `时脉报告_${currentYear}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    exportError.value = (e as Error).message || '导出失败，请稍后重试'
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await userStore.restore()
  await loadData()
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <!-- 页头 -->
      <div class="mb-lg flex items-center justify-between">
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">时脉报告</h1>
        <div class="flex flex-col items-end gap-xs">
          <div class="flex gap-xs">
            <BaseButton variant="ghost" @click="shareOpen = true">分享时脉</BaseButton>
            <BaseButton variant="ghost" :disabled="exporting" @click="handleExport">
              {{ exporting ? '导出中…' : '导出 CSV' }}
            </BaseButton>
          </div>
          <p v-if="exportError" class="text-label-sm text-danger">{{ exportError }}</p>
        </div>
      </div>

      <div v-if="loading" class="py-xl text-center text-body-md text-ink-muted">加载中…</div>

      <div v-else-if="loadError" class="py-xl text-center">
        <p class="text-body-md text-danger">{{ loadError }}</p>
        <BaseButton variant="ghost" class="mt-md" @click="loadData">重试</BaseButton>
      </div>

      <div v-else class="space-y-lg">
        <!-- 年度盘点 -->
        <section v-if="annualReview" class="rounded-lg bg-paper-elevated border border-hairline p-lg shadow-level-1">
          <h2 class="mb-md text-title-lg text-ink-primary">{{ currentYear }} 年度盘点</h2>
          <div class="grid grid-cols-2 gap-md sm:grid-cols-4">
            <div class="text-center">
              <p class="text-label-sm text-ink-muted">总阅读时长</p>
              <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ formatHours(annualReview.totalSeconds) }}</p>
            </div>
            <div class="text-center">
              <p class="text-label-sm text-ink-muted">阅读场次</p>
              <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ formatNumber(annualReview.sessionCount) }}</p>
            </div>
            <div class="text-center">
              <p class="text-label-sm text-ink-muted">阅读书目</p>
              <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ annualReview.bookCount }}</p>
            </div>
            <div class="text-center">
              <p class="text-label-sm text-ink-muted">最长连续</p>
              <p class="mt-2xs text-title-lg font-serif tabular-nums text-pine-deep">{{ annualReview.longestStreak }} 天</p>
            </div>
          </div>
        </section>

        <!-- 时长折线图 -->
        <section class="rounded-lg bg-paper-elevated border border-hairline p-lg shadow-level-1">
          <div class="mb-md flex items-center justify-between">
            <h2 class="text-title-lg text-ink-primary">阅读时长趋势</h2>
            <div class="flex gap-xs rounded-lg bg-paper-warm p-xs">
              <button
                v-for="tab in tabs"
                :key="tab.key"
                type="button"
                class="rounded px-md py-[2px] text-label-md transition-all"
                :class="
                  activeTab === tab.key
                    ? 'bg-pine-deep text-paper-elevated font-medium'
                    : 'text-ink-muted hover:text-ink-primary'
                "
                @click="activeTab = tab.key"
              >
                {{ tab.label }}
              </button>
            </div>
          </div>
          <DurationChart v-if="chartData.length > 0" :data="chartData" :height="180" />
          <BaseEmpty v-else title="暂无阅读数据" description="开始阅读计时后这里会显示你的阅读趋势" />
        </section>

        <!-- 热力日历 -->
        <section class="rounded-lg bg-paper-elevated border border-hairline p-lg shadow-level-1">
          <h2 class="mb-md text-title-lg text-ink-primary">脉搏热力日历</h2>
          <PulseHeatmap v-if="yearData.length > 0" :data="yearData" />
          <BaseEmpty v-else title="暂无阅读数据" description="每日阅读后会在此点亮你的阅读脉搏" />
        </section>

        <!-- 阅读目标 -->
        <section>
          <h2 class="mb-md text-title-lg text-ink-primary">阅读目标</h2>
          <GoalCard
            :goals="goals"
            :streak="streak"
            @create="handleCreateGoal"
            @update="handleUpdateGoal"
          />
        </section>
      </div>
    </div>

    <ShareDialog
      :open="shareOpen"
      type="pulse"
      :target-id="userStore.user?.id ?? 0"
      title="分享我的时脉"
      @close="shareOpen = false"
    />
  </main>
</template>
