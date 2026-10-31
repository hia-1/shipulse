<script setup lang="ts">
/**
 * 文本域（与 BaseInput 同款聚焦光晕）
 */
withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    rows?: number
  }>(),
  { modelValue: '', placeholder: '', disabled: false, rows: 4 },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    class="w-full resize-y rounded border border-hairline bg-paper-elevated px-sm py-sm text-body-md text-ink-primary placeholder:text-ink-muted transition-shadow duration-150 focus:border-pine-deep focus:outline-none focus:ring-[3px] focus:ring-pine-deep/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>
