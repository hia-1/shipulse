<script setup lang="ts">
/**
 * Chip 与筛选器（DESIGN.md Components > Chips & Filters）
 * selected: 选中态（pine-subtle 底 + pine-deep 边）
 */
withDefaults(
  defineProps<{
    selected?: boolean
    disabled?: boolean
  }>(),
  { selected: false, disabled: false },
)
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="inline-flex items-center rounded text-label-md transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
    style="padding: 6px 14px"
    :class="
      selected
        ? 'border border-pine-deep bg-pine-subtle font-medium text-pine-deep'
        : 'border border-hairline bg-paper-warm text-ink-secondary hover:border-border-muted'
    "
  >
    <slot />
  </button>
</template>
