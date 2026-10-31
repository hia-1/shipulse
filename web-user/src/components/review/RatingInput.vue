<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 五星制半星评分（可 0.5 步进）。
 * 在星星行上移动选择 0.5~5.0，点击提交；鼠标移出恢复为已选值。
 */
const modelValue = defineModel<number>({ default: 0 })

const hover = ref<number | null>(null)

const display = computed(() => hover.value ?? modelValue.value ?? 0)
const uid = `ri-${Math.random().toString(36).slice(2, 8)}`

const STAR_PATH =
  'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.11 6.47L12 17.9l-5.81 3.05L7.3 14.05l-4.7-4.6 6.5-.95L12 2.6z'

function level(i: number): number {
  const v = display.value
  if (v >= i) return 1
  if (v >= i - 0.5) return 0.5
  return 0
}

function onStarMove(s: number, e: MouseEvent) {
  const el = e.currentTarget as HTMLElement
  const half = e.clientX - el.getBoundingClientRect().left < el.offsetWidth / 2
  hover.value = half ? s - 0.5 : s
}

function commit() {
  const v = display.value
  if (v > 0) modelValue.value = v
}

function label(v: number): string {
  return v > 0 ? `${v.toFixed(1)} 星` : '请评分'
}
</script>

<template>
  <div class="inline-flex items-center gap-sm">
    <span class="flex items-center gap-0.5" @mouseleave="hover = null">
      <span
        v-for="s in 5"
        :key="s"
        class="cursor-pointer p-px transition-transform hover:scale-110"
        @mousemove="onStarMove(s, $event)"
        @click="commit"
      >
        <svg :width="26" :height="26" viewBox="0 0 24 24" class="block">
          <defs>
            <clipPath :id="`${uid}-half-${s}`">
              <rect :width="26 * level(s)" :height="26" x="0" y="0" />
            </clipPath>
          </defs>
          <path :d="STAR_PATH" class="fill-border-muted" />
          <path
            :d="STAR_PATH"
            class="fill-gold-patina"
            :clip-path="level(s) >= 1 ? undefined : `url(#${uid}-half-${s})`"
          />
        </svg>
      </span>
    </span>
    <span class="text-label-md text-ink-muted tabular-nums">{{ label(display) }}</span>
  </div>
</template>