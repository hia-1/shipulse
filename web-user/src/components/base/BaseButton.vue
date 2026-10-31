<script setup lang="ts">
/**
 * 按钮（DESIGN.md Components > Buttons）
 * variant: primary 主按钮 / ghost 次幽灵 / text 文字链接
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'text'
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', disabled: false, type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="inline-flex items-center justify-center gap-xs rounded px-lg py-sm text-label-md transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-pine-deep text-paper-elevated hover:bg-pine-hover hover:-translate-y-px active:translate-y-0':
        variant === 'primary',
      'border border-hairline bg-transparent text-ink-primary hover:bg-paper-warm hover:border-border-muted':
        variant === 'ghost',
      'px-xs text-pine-deep underline-offset-2 hover:underline': variant === 'text',
    }"
  >
    <slot />
  </button>
</template>
