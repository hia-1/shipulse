<script setup lang="ts">
import { ref } from 'vue'
import { BaseModal, BaseButton, BaseInput, BaseTextarea } from '@/components/base'
import { useTimerStore } from '@/stores/timer'

const timer = useTimerStore()

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ finished: [] }>()

const endPage = ref('')
const note = ref('')

function handleClose() {
  open.value = false
}

async function handleFinish() {
  await timer.stop(
    endPage.value ? Number(endPage.value) : undefined,
    note.value || undefined,
  )
  endPage.value = ''
  note.value = ''
  open.value = false
  emit('finished')
}

function handleCancel() {
  timer.pause()
  open.value = false
}
</script>

<template>
  <BaseModal :open="open" title="结束阅读" @close="handleClose">
    <div class="space-y-md">
      <!-- 阅读信息 -->
      <div class="flex items-center gap-md rounded-lg bg-paper-warm p-md">
        <div class="h-12 w-9 flex-shrink-0 overflow-hidden rounded-sm">
          <img
            v-if="timer.coverUrl"
            :src="timer.coverUrl"
            :alt="timer.bookTitle"
            class="h-full w-full object-cover"
          />
          <div v-else class="flex h-full w-full items-center justify-center bg-paper-warm text-label-sm text-ink-faint">
            无封面
          </div>
        </div>
        <div>
          <p class="text-body-md text-ink-primary">{{ timer.bookTitle }}</p>
          <p class="text-label-sm text-ink-muted">
            已读 <span class="tabular-nums text-pine-deep font-medium">{{ timer.displayTime }}</span>
          </p>
        </div>
      </div>

      <!-- 结束页码 -->
      <div>
        <label class="mb-2xs block text-label-md text-ink-secondary">结束页码</label>
        <BaseInput
          v-model="endPage"
          type="number"
          placeholder="当前读到第几页"
        />
      </div>

      <!-- 笔记摘抄 -->
      <div>
        <label class="mb-2xs block text-label-md text-ink-secondary">笔记摘抄（可选）</label>
        <BaseTextarea
          v-model="note"
          placeholder="记录本次阅读的感想或摘抄…"
          :rows="3"
        />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-sm">
        <BaseButton variant="ghost" @click="handleCancel">取消（暂停计时）</BaseButton>
        <BaseButton variant="primary" :disabled="timer.loading" @click="handleFinish">
          {{ timer.loading ? '提交中…' : '完成阅读' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
