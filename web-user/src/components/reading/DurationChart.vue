<script setup lang="ts">
import { computed } from 'vue'
import type { DailyDuration } from '@/api/reading'

/**
 * 场次波形/时长曲线（DESIGN.md 时脉可视化规范）
 * 2px 平滑描边 #2D4A43 + 超浅渐变填充 rgba(45,74,67,0.06)→透明
 * 里程碑以古金绿 #C29B38 发光环节点标记
 */
const props = withDefaults(
  defineProps<{
    data: DailyDuration[]
    height?: number
  }>(),
  { height: 160 },
)

const WIDTH = 600
const PADDING_LEFT = 40
const PADDING_RIGHT = 12
const PADDING_TOP = 12
const PADDING_BOTTOM = 24

const chartWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT
const chartHeight = computed(() => props.height - PADDING_TOP - PADDING_BOTTOM)

const maxSeconds = computed(() => {
  if (props.data.length === 0) return 3600
  const max = Math.max(...props.data.map((d) => d.seconds))
  return max > 0 ? max : 3600
})

const points = computed(() => {
  if (props.data.length === 0) return []
  const n = props.data.length
  return props.data.map((d, i) => {
    const x = PADDING_LEFT + (n === 1 ? chartWidth / 2 : (i / (n - 1)) * chartWidth)
    const y = PADDING_TOP + chartHeight.value - (d.seconds / maxSeconds.value) * chartHeight.value
    return { x, y, date: d.date, seconds: d.seconds }
  })
})

const linePath = computed(() => {
  if (points.value.length === 0) return ''
  return points.value
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ')
})

const areaPath = computed(() => {
  if (points.value.length === 0) return ''
  const first = points.value[0]
  const last = points.value[points.value.length - 1]
  const baseY = PADDING_TOP + chartHeight.value
  return `${linePath.value} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`
})

const yTicks = computed(() => {
  const max = maxSeconds.value
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    value: Math.round(max * r),
    y: PADDING_TOP + chartHeight.value - r * chartHeight.value,
  }))
  return ticks
})

function formatMinutes(seconds: number): string {
  const m = Math.floor(seconds / 60)
  if (m >= 60) return `${Math.floor(m / 60)}h`
  return `${m}m`
}

const xLabels = computed(() => {
  if (points.value.length === 0) return []
  const n = points.value.length
  const step = Math.max(1, Math.floor(n / 6))
  const labels: { x: number; label: string }[] = []
  for (let i = 0; i < n; i += step) {
    const p = points.value[i]
    const date = new Date(p.date)
    labels.push({
      x: p.x,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
    })
  }
  return labels
})

const milestones = computed(() => {
  return points.value.filter((p) => p.seconds >= 7200)
})
</script>

<template>
  <div class="w-full">
    <svg :viewBox="`0 0 ${WIDTH} ${height}`" class="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient :id="`grad-${height}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color: rgb(var(--c-pine-deep))" stop-opacity="0.06" />
          <stop offset="100%" style="stop-color: rgb(var(--c-pine-deep))" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Y-axis grid lines and labels -->
      <g v-for="(tick, i) in yTicks" :key="`y-${i}`">
        <line
          :x1="PADDING_LEFT"
          :y1="tick.y"
          :x2="WIDTH - PADDING_RIGHT"
          :y2="tick.y"
          class="stroke-hairline"
          stroke-width="1"
        />
        <text
          :x="PADDING_LEFT - 6"
          :y="tick.y + 3"
          text-anchor="end"
          class="fill-ink-faint text-[10px] tabular-nums"
        >
          {{ formatMinutes(tick.value) }}
        </text>
      </g>

      <!-- Area fill -->
      <path :d="areaPath" :fill="`url(#grad-${height})`" />

      <!-- Line -->
      <path
        :d="linePath"
        class="fill-none stroke-pine-deep"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />

      <!-- Milestone nodes (120+ minutes) -->
      <g v-for="(m, i) in milestones" :key="`m-${i}`">
        <circle :cx="m.x" :cy="m.y" r="5" class="fill-gold-patina" opacity="0.2" />
        <circle :cx="m.x" :cy="m.y" r="3" class="fill-gold-patina" />
      </g>

      <!-- X-axis labels -->
      <text
        v-for="(label, i) in xLabels"
        :key="`x-${i}`"
        :x="label.x"
        :y="height - 6"
        text-anchor="middle"
        class="fill-ink-faint text-[10px] tabular-nums"
      >
        {{ label.label }}
      </text>
    </svg>
  </div>
</template>
