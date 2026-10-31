<script setup lang="ts">
/**
 * 输入框（DESIGN.md Components > Input Fields）
 * 聚焦：pine-deep 边框 + 3px 松绿光晕
 * type="number" 时向外抛出 number（空值抛空串），避免数字字段被写入字符串
 */
const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    placeholder?: string
    disabled?: boolean
    type?: string
  }>(),
  { modelValue: '', placeholder: '', disabled: false, type: 'text' },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', props.type === 'number' ? (value === '' ? '' : Number(value)) : value)
}
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    class="w-full rounded border border-hairline bg-paper-elevated px-sm py-sm text-body-md text-ink-primary placeholder:text-ink-muted transition-shadow duration-150 focus:border-pine-deep focus:outline-none focus:ring-[3px] focus:ring-pine-deep/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
    @input="onInput"
  />
</template>
