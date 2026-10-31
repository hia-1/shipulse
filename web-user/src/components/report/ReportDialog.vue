<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BaseButton, BaseModal, BaseTextarea } from '@/components/base'
import { showToast } from '@/composables/useToast'
import {
  submitReport,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  type ReportTarget,
  type ReportReason,
} from '@/api/report'

const props = defineProps<{
  open: boolean
  targetType: ReportTarget
  targetId: string | number
  targetLabel?: string
}>()

const emit = defineEmits<{ close: []; submitted: [] }>()

const reason = ref<ReportReason | ''>('')
const description = ref('')
const submitting = ref(false)
const error = ref('')

const targetText = computed(
  () => props.targetLabel || REPORT_TARGET_LABELS[props.targetType] || props.targetType,
)

watch(
  () => props.open,
  (v) => {
    if (v) {
      reason.value = ''
      description.value = ''
      error.value = ''
    }
  },
)

async function submit() {
  if (!reason.value) {
    error.value = '请选择举报原因'
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await submitReport({
      targetType: props.targetType,
      targetId: String(props.targetId),
      reason: reason.value,
      description: description.value.trim(),
    })
    showToast('举报已提交，我们会尽快核实', 'success')
    emit('submitted')
    emit('close')
  } catch (e) {
    error.value = (e as Error).message || '举报提交失败'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" title="举报内容" @close="emit('close')">
    <div class="space-y-md">
      <p class="text-body-sm text-ink-muted">
        举报对象：<span class="text-ink-primary">{{ targetText }}</span>
        <span class="text-ink-faint"> #{{ targetId }}</span>
      </p>

      <div class="space-y-2xs">
        <label class="text-label-md text-ink-muted">举报原因 *</label>
        <div class="grid grid-cols-2 gap-sm">
          <button
            v-for="r in REPORT_REASONS"
            :key="r"
            type="button"
            class="rounded border px-sm py-sm text-body-sm transition-colors"
            :class="reason === r
              ? 'border-pine-deep text-pine-deep bg-pine-subtle'
              : 'border-hairline text-ink-secondary hover:border-border-muted'"
            @click="reason = r"
          >
            {{ REPORT_REASON_LABELS[r] }}
          </button>
        </div>
      </div>

      <div class="space-y-2xs">
        <label class="text-label-md text-ink-muted">补充说明（选填）</label>
        <BaseTextarea
          v-model="description"
          :rows="3"
          placeholder="请描述具体情况，便于我们核实（500字以内）"
        />
      </div>

      <p v-if="error" class="text-body-sm text-danger">{{ error }}</p>

      <div class="flex gap-sm">
        <BaseButton variant="ghost" class="flex-1" type="button" @click="emit('close')">取消</BaseButton>
        <BaseButton class="flex-1" type="button" :disabled="submitting" @click="submit">
          {{ submitting ? '提交中…' : '提交举报' }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>
