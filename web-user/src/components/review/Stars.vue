<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    size?: number
  }>(),
  { size: 16 },
)

/** 每个星（i=1..5）的填充程度：1 满格 0.5 半格 0 空 */
function level(i: number): number {
  const v = props.value
  if (v >= i) return 1
  if (v >= i - 0.5) return 0.5
  return 0
}

const stars = computed(() => [1, 2, 3, 4, 5])

// 每个发光滤镜/裁剪的 id 唯一，避免同页多个 Stars 实例 id 冲突
const uid = `rv-${Math.random().toString(36).slice(2, 8)}`

const STAR_PATH =
  'M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.11 6.47L12 17.9l-5.81 3.05L7.3 14.05l-4.7-4.6 6.5-.95L12 2.6z'
</script>

<template>
  <span class="inline-flex items-center gap-0.5" aria-label="评分">
    <svg
      v-for="s in stars"
      :key="s"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      class="inline-block shrink-0"
    >
      <defs>
        <clipPath :id="`${uid}-half-${s}`">
          <rect :width="size * level(s)" :height="size" x="0" y="0" />
        </clipPath>
      </defs>
      <path :d="STAR_PATH" class="fill-border-muted" />
      <path
        v-if="level(s) > 0"
        :d="STAR_PATH"
        class="fill-gold-patina"
        :clip-path="level(s) >= 1 ? undefined : `url(#${uid}-half-${s})`"
      />
    </svg>
  </span>
</template>