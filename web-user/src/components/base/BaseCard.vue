<script setup lang="ts">
/**
 * 内容卡片（Surface Level 1：paper-elevated + hairline 边 + 轻投影）
 */
withDefaults(
  defineProps<{
    hoverable?: boolean
  }>(),
  { hoverable: false },
)
</script>

<template>
  <div
    class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1"
    :class="hoverable && 'transition-all duration-200 hover:shadow-level-2 hover:-translate-y-px'"
  >
    <slot />
  </div>
</template>
