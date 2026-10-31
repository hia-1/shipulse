<script setup lang="ts">
/**
 * 书封卡（DESIGN.md Components > Reading Cards / Shapes）
 * 3:4 宽高比 + 0.25rem 微圆角 + 左侧书脊投影
 */
withDefaults(
  defineProps<{
    src?: string
    title?: string
  }>(),
  { src: '', title: '' },
)
</script>

<template>
  <div class="relative aspect-[3/4] overflow-hidden rounded-sm bg-paper-warm shadow-spine">
    <img
      v-if="src"
      :src="src"
      :alt="title"
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <div
      v-else
      class="flex h-full w-full items-center justify-center p-sm text-center font-serif text-body-sm text-ink-muted"
    >
      {{ title || '暂无封面' }}
    </div>
    <!-- 书脊高光：左侧细微明暗过渡，强化书脊投影的真实感 -->
    <div
      class="pointer-events-none absolute inset-y-0 left-0 w-[6%]"
      style="background: linear-gradient(to right, rgba(26, 36, 33, 0.12), transparent)"
    />
  </div>
</template>
