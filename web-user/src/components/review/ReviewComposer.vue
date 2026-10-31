<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  createReview,
  deleteReview,
  getMyReview,
  type ReviewItem,
} from '@/api/review'
import { BaseButton, BaseInput, BaseModal, BaseTextarea } from '@/components/base'
import RatingInput from './RatingInput.vue'
import Stars from './Stars.vue'

const props = defineProps<{
  open: boolean
  bookId: number
  bookTitle: string
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const rating = ref(0)
const title = ref('')
const content = ref('')
const submitting = ref(false)
const message = ref('')
const error = ref('')
const done = ref(false)

/** 我已有书评的展示态 */
const mine = ref<ReviewItem | null>(null)
const deleting = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    message.value = ''
    submitting.value = false
    deleting.value = false
    done.value = false
    rating.value = 0
    title.value = ''
    content.value = ''
    void loadMine()
  },
)

async function loadMine() {
  mine.value = null
  try {
    const res = await getMyReview(props.bookId)
    mine.value = res.data
  } catch {
    mine.value = null
  }
}

async function submit() {
  error.value = ''
  message.value = ''
  submitting.value = true
  try {
    const res = await createReview({
      bookId: props.bookId,
      rating: rating.value,
      title: title.value.trim(),
      content: content.value.trim(),
    })
    const audit = res.data.audit
    if (audit.status === 'approved') {
      done.value = true
      message.value = '书评已通过审核并发布，感谢你的分享'
      emit('submitted')
    } else if (audit.status === 'pending') {
      done.value = true
      message.value = '书评已提交，正等待人工复核，通过后即可展示'
      emit('submitted')
    } else {
      error.value = audit.reason ? `书评未通过审核：${audit.reason}` : '书评未通过审核，请修改后重试'
    }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    submitting.value = false
  }
}

async function removeMine() {
  if (!mine.value) return
  deleting.value = true
  try {
    await deleteReview(mine.value.id)
    mine.value = null
    emit('submitted')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" :title="bookTitle ? `《${bookTitle}》 · 书评` : '写书评'" @close="emit('close')">
    <!-- 已发过书评 -->
    <div v-if="mine" class="space-y-md">
      <p class="text-body-md text-ink-primary">你已评价过这本书：</p>
      <div class="rounded-lg border border-hairline bg-paper-warm p-md">
        <div class="flex items-center gap-sm">
          <Stars :value="Number(mine.rating)" :size="14" />
          <span class="text-label-md text-ink-secondary tabular-nums">{{ Number(mine.rating).toFixed(1) }}</span>
        </div>
        <p class="mt-xs font-serif text-title-md text-ink-primary">{{ mine.title }}</p>
        <p v-if="mine.audit" class="mt-xs text-label-sm" :class="mine.audit.status === 'approved' ? 'text-pine-deep' : 'text-gold-patina'">
          {{
            {
              approved: '已发布',
              pending: '审核中',
              rejected: mine.audit.reason || '未通过审核',
            }[mine.audit.status] || '已发布'
          }}
        </p>
      </div>
      <div class="flex items-center justify-end gap-sm">
        <BaseButton variant="ghost" :disabled="deleting" @click="removeMine">
          {{ deleting ? '删除中…' : '删除书评' }}
        </BaseButton>
        <BaseButton @click="emit('close')">知道了</BaseButton>
      </div>
    </div>

    <!-- 提交成功态 -->
    <div v-else-if="done" class="space-y-md text-center py-sm">
      <p class="text-body-md text-ink-primary">{{ message }}</p>
      <BaseButton @click="emit('close')">完成</BaseButton>
    </div>

    <!-- 发评表单 -->
    <div v-else class="space-y-lg">
      <div class="flex flex-col gap-xs">
        <label class="text-label-sm text-ink-muted">评分</label>
        <RatingInput v-model="rating" />
        <p v-if="rating <= 0" class="text-label-sm text-ink-muted">点击星星选择评分（支持半星）</p>
      </div>

      <div class="flex flex-col gap-xs">
        <label class="text-label-sm text-ink-muted">标题</label>
        <BaseInput v-model="title" placeholder="一句话概括你的读后感受" />
      </div>

      <div class="flex flex-col gap-xs">
        <label class="text-label-sm text-ink-muted">正文（选填）</label>
        <BaseTextarea v-model="content" :rows="5" placeholder="写下你的读后感想、摘抄或思考…" />
      </div>

      <p v-if="error" class="rounded-lg bg-paper-warm px-sm py-xs text-body-sm text-danger">{{ error }}</p>

      <div class="flex items-center justify-end gap-sm">
        <BaseButton variant="ghost" @click="emit('close')">取消</BaseButton>
        <BaseButton
          :disabled="submitting || rating <= 0 || !title.trim()"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交书评' }}
        </BaseButton>
      </div>
    </div>
  </BaseModal>
</template>