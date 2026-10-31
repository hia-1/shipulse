<script setup lang="ts">
/**
 * 空状态
 */
withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  { title: '暂无内容', description: '' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center py-2xl text-center">
    <div
      class="mb-md flex h-16 w-16 items-center justify-center rounded-full bg-paper-warm text-2xl text-ink-faint"
    >
      <slot name="icon">📖</slot>
    </div>
    <p class="text-title-md text-ink-secondary">{{ title }}</p>
    <p v-if="description" class="mt-2xs text-body-sm text-ink-muted">{{ description }}</p>
    <div v-if="$slots.action" class="mt-lg">
      <slot name="action" />
    </div>
  </div>
</template>
