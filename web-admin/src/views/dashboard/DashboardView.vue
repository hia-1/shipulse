<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { getDashboardStats, getDashboardTrend, type DashboardStats, type TrendPoint } from '@/api/adminManage'

const loading = ref(true)
const stats = ref<DashboardStats | null>(null)
const trend = ref<TrendPoint[]>([])
const days = ref(30)

async function loadStats() {
  loading.value = true
  try {
    const res = await getDashboardStats()
    stats.value = res.data
  } finally {
    loading.value = false
  }
}

async function loadTrend() {
  const res = await getDashboardTrend(days.value)
  trend.value = res.data || []
}

const yuan = (fen: number) => (fen / 100).toFixed(2)

const kpiCards = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    { label: '注册用户', value: s.users.total, unit: '人', delta: `今日 +${s.users.today}`, tone: '#2d4a43' },
    { label: '7 日活跃', value: s.users.active7d, unit: '人', delta: '近 7 日登录', tone: '#3a8e6f' },
    { label: '书籍总数', value: s.books.total, unit: '本', delta: `已上架 ${s.books.published}`, tone: '#c9883a' },
    { label: '书评总量', value: s.reviews.total, unit: '篇', delta: `待审 ${s.reviews.pending}`, tone: '#5085c9' },
    { label: '在籍会员', value: s.members.active, unit: '人', delta: '有效会员', tone: '#9a5cc9' },
    { label: '营收（元）', value: yuan(s.finance.revenueFen), unit: '', delta: `今日 ${yuan(s.finance.revenueTodayFen)}`, tone: '#c9514b' },
  ]
})

const maxRevenue = computed(() =>
  Math.max(...trend.value.map((t) => t.revenueFen), 1),
)
// 仅按实际绘制的「用户 / 单量」两条线取最大值，避免未绘制序列压缩曲线
const maxUsers = computed(() =>
  Math.max(...trend.value.map((t) => Math.max(t.users, t.orders)), 1),
)

const svgW = 1000
const svgH = 220

function pointX(i: number) {
  return trend.value.length > 1 ? 30 + (i * (svgW - 60)) / (trend.value.length - 1) : svgW / 2
}
function y(v: number, max: number) {
  return svgH - 24 - (v / max) * (svgH - 48)
}
function linePath(key: keyof TrendPoint, max: number) {
  return trend.value
    .map((t, i) => `${i === 0 ? 'M' : 'L'}${pointX(i).toFixed(1)},${y(Number(t[key]), max).toFixed(1)}`)
    .join(' ')
}
// 稀疏化 x 轴刻度，最多约 7 个，避免 30/90 天标签互相重叠
const xTicks = computed(() => {
  const n = trend.value.length
  if (n <= 7) return trend.value.map((_, i) => i)
  const step = Math.ceil(n / 7)
  const idx: number[] = []
  for (let i = 0; i < n; i += step) idx.push(i)
  if (idx[idx.length - 1] !== n - 1) idx.push(n - 1)
  return idx
})

// viewBox 坐标系(0~svgW) → 容器百分比，保证标签与折线点位对齐
function labelLeft(i: number) {
  return `${(pointX(i) / svgW) * 100}%`
}

onMounted(async () => {
  await Promise.all([loadStats(), loadTrend()])
  loading.value = false
})

function switchDays(n: number) {
  days.value = n
  loadTrend()
}
</script>

<template>
  <div class="dashboard">
    <el-card shadow="never" class="stat-card" v-loading="loading && !stats">
      <template #header>
        <span class="section-title">运营总览</span>
        <span class="section-tip">{{ stats ? `今日新增用户 ${stats.users.today} · 今日营收 ¥${yuan(stats.finance.revenueTodayFen)}` : '' }}</span>
      </template>
      <div v-if="stats" class="kpi-grid">
        <div v-for="c in kpiCards" :key="c.label" class="kpi-item" :style="{ '--tone': c.tone }">
          <div class="kpi-value">{{ c.value }}<span class="kpi-unit">{{ c.unit }}</span></div>
          <div class="kpi-label">{{ c.label }}</div>
          <div class="kpi-delta">{{ c.delta }}</div>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" v-loading="loading">
      <template #header>
        <div class="trend-header">
          <span class="section-title">近期趋势</span>
          <el-radio-group :model-value="days" size="small" @update:model-value="switchDays">
            <el-radio-button :value="7">近 7 天</el-radio-button>
            <el-radio-button :value="30">近 30 天</el-radio-button>
            <el-radio-button :value="90">近 90 天</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div v-if="trend.length" class="chart">
        <svg :viewBox="`0 0 ${svgW} ${svgH}`" preserveAspectRatio="none" class="chart-svg">
          <line v-for="g in 4" :key="g" :x1="30" :x2="svgW - 30" :y1="g * (svgH / 5)" :y2="g * (svgH / 5)" stroke="#ecefec" stroke-width="1" />
          <path :d="linePath('users', maxUsers)" fill="none" stroke="#2d4a43" stroke-width="2.5" />
          <path :d="linePath('orders', maxUsers)" fill="none" stroke="#3a8e6f" stroke-width="2" />
          <path :d="linePath('revenueFen', maxRevenue)" fill="none" stroke="#c9514b" stroke-width="2" stroke-dasharray="5 4" />
        </svg>
        <div class="legend">
          <span><i class="dot" style="background:#2d4a43" />用户</span>
          <span><i class="dot" style="background:#3a8e6f" />单量</span>
          <span><i class="dot" style="background:#c9514b" />营收(元)</span>
        </div>
        <div class="x-labels">
          <span v-for="i in xTicks" :key="i" class="x-label" :style="{ left: labelLeft(i) }">{{ trend[i].date.slice(5) }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无趋势数据" :image-size="80" />
    </el-card>

    <el-card shadow="never" v-if="stats">
      <template #header><span class="section-title">待处理任务</span></template>
      <div class="pending-grid">
        <div class="pending-item">
          <div class="pending-num">{{ stats.moderation.reviewsPending }}</div>
          <div class="pending-name">待审书评</div>
        </div>
        <div class="pending-item">
          <div class="pending-num">{{ stats.moderation.postsPending }}</div>
          <div class="pending-name">待审动态</div>
        </div>
        <div class="pending-item">
          <div class="pending-num">{{ stats.moderation.booklistsPending }}</div>
          <div class="pending-name">待审书单</div>
        </div>
        <div class="pending-item">
          <div class="pending-num">{{ stats.finance.pendingCount || 0 }}</div>
          <div class="pending-name">待支付订单</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard { display: flex; flex-direction: column; gap: 16px; }
.stat-card { --el-card-border-radius: 10px; }
.section-title { font-size: 15px; font-weight: 600; color: #2d4a43; }
.section-tip { float: right; font-size: 12px; color: #84968d; }
.trend-header { display: flex; align-items: center; justify-content: space-between; }

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kpi-item { background: #f7f9f7; border-radius: 8px; padding: 14px 16px; border-left: 3px solid var(--tone); }
.kpi-value { font-size: 24px; font-weight: 700; color: var(--tone); }
.kpi-unit { font-size: 13px; font-weight: 400; margin-left: 2px; color: #84968d; }
.kpi-label { margin-top: 6px; font-size: 13px; color: #4a5753; }
.kpi-delta { margin-top: 2px; font-size: 12px; color: #84968d; }

.chart { position: relative; height: 260px; }
.chart-svg { width: 100%; height: 220px; display: block; }
.legend { display: flex; gap: 18px; font-size: 12px; color: #4a5753; margin-top: 4px; }
.legend .dot { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 5px; }
.x-labels { position: relative; height: 20px; }
.x-label { position: absolute; transform: translateX(-50%); font-size: 10px; color: #99a59f; }

.pending-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.pending-item { text-align: center; padding: 16px 0; background: #f7f9f7; border-radius: 8px; }
.pending-num { font-size: 26px; font-weight: 700; color: #2d4a43; }
.pending-name { margin-top: 4px; font-size: 13px; color: #4a5753; }
</style>