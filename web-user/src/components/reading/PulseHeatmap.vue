<script setup lang="ts">
import { computed } from 'vue'
import type { DailyDuration } from '@/api/reading'

/**
 * 脉搏热力日历（DESIGN.md 时脉可视化规范）
 * 12px×12px 方块、3px 间距、2px 圆角
 * 强度 0 分钟 → 120+ 分钟共 5 级，色阶走 CSS 变量以适配深色主题
 */
const props = defineProps<{ data: DailyDuration[] }>()

const CELL = 12
const GAP = 3
const RADIUS = 2

const colorLevels = [
  'rgb(var(--c-heat-0))',
  'rgb(var(--c-heat-1))',
  'rgb(var(--c-heat-2))',
  'rgb(var(--c-heat-3))',
  'rgb(var(--c-heat-4))',
]

function getLevel(seconds: number): number {
  if (seconds <= 0) return 0
  if (seconds < 1800) return 1
  if (seconds < 3600) return 2
  if (seconds < 7200) return 3
  return 4
}

function getColor(seconds: number): string {
  return colorLevels[getLevel(seconds)]
}

const cells = computed(() => {
  const map = new Map<string, number>()
  for (const d of props.data) {
    map.set(d.date, d.seconds)
  }

  if (props.data.length === 0) return { weeks: [], monthLabels: [] }

  const firstDate = new Date(props.data[0].date)
  const lastDate = new Date(props.data[props.data.length - 1].date)

  const startSunday = new Date(firstDate)
  startSunday.setDate(startSunday.getDate() - startSunday.getDay())

  const weeks: { date: string; seconds: number; col: number; row: number }[][] = []
  const cursor = new Date(startSunday)
  let col = 0

  while (cursor <= lastDate) {
    const week: { date: string; seconds: number; col: number; row: number }[] = []
    for (let row = 0; row < 7; row++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      const seconds = map.get(dateStr) ?? 0
      const inRange = cursor >= firstDate && cursor <= lastDate
      week.push({
        date: inRange ? dateStr : '',
        seconds: inRange ? seconds : -1,
        col,
        row,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
    col++
  }

  const monthLabels: { label: string; col: number }[] = []
  let lastMonth = -1
  weeks.forEach((week, weekIdx) => {
    const midCell = week[3]
    if (midCell.date) {
      const month = new Date(midCell.date).getMonth()
      if (month !== lastMonth) {
        monthLabels.push({ label: `${month + 1}月`, col: weekIdx })
        lastMonth = month
      }
    }
  })

  return { weeks, monthLabels }
})

const svgWidth = computed(() => {
  if (!cells.value.weeks || cells.value.weeks.length === 0) return 0
  return cells.value.weeks.length * (CELL + GAP) + 40
})

const svgHeight = 7 * (CELL + GAP) + 24
</script>

<template>
  <div class="overflow-x-auto">
    <svg :width="svgWidth" :height="svgHeight" class="block">
      <!-- Month labels -->
      <text
        v-for="(m, i) in cells.monthLabels"
        :key="i"
        :x="28 + m.col * (CELL + GAP)"
        :y="10"
        class="fill-ink-muted text-[10px]"
      >
        {{ m.label }}
      </text>

      <!-- Cells -->
      <template v-for="(week, weekIdx) in cells.weeks" :key="weekIdx">
        <rect
          v-for="(cell, cellIdx) in week"
          :key="cellIdx"
          :x="28 + weekIdx * (CELL + GAP)"
          :y="18 + cellIdx * (CELL + GAP)"
          :width="CELL"
          :height="CELL"
          :rx="RADIUS"
          :fill="cell.seconds < 0 ? 'transparent' : getColor(cell.seconds)"
          :class="cell.seconds > 0 ? 'cursor-pointer' : ''"
        >
          <title v-if="cell.date">{{ cell.date }}: {{ Math.floor(cell.seconds / 60) }}分钟</title>
        </rect>
      </template>
    </svg>

    <!-- Legend -->
    <div class="mt-sm flex items-center gap-xs text-label-sm text-ink-muted">
      <span>少</span>
      <svg :width="CELL * 5 + GAP * 4" :height="CELL">
        <rect
          v-for="(color, i) in colorLevels"
          :key="i"
          :x="i * (CELL + GAP)"
          :y="0"
          :width="CELL"
          :height="CELL"
          :rx="RADIUS"
          :fill="color"
        />
      </svg>
      <span>多</span>
    </div>
  </div>
</template>
