<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { BaseButton, BaseEmpty, BaseInput, BaseTextarea } from '@/components/base'
import { showToast } from '@/composables/useToast'
import {
  submitFeedback,
  listMyFeedback,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_STATUS_LABELS,
  type FeedbackType,
  type FeedbackItem,
} from '@/api/feedback'

const MAX = 1000

const type = ref<FeedbackType>('suggestion')
const content = ref('')
const contact = ref('')
const submitting = ref(false)
const error = ref('')

const history = ref<FeedbackItem[]>([])
const loadingHistory = ref(true)

async function loadHistory() {
  loadingHistory.value = true
  try {
    const res = await listMyFeedback(1, 20)
    history.value = res.data.list
  } catch {
    history.value = []
  } finally {
    loadingHistory.value = false
  }
}

async function submit() {
  const text = content.value.trim()
  if (text.length < 5) {
    error.value = '反馈内容至少 5 个字，便于我们理解你的问题'
    return
  }
  if (text.length > MAX) {
    error.value = `反馈内容不能超过 ${MAX} 字`
    return
  }
  submitting.value = true
  error.value = ''
  try {
    await submitFeedback({
      type: type.value,
      content: text,
      contact: contact.value.trim(),
    })
    showToast('反馈已提交，感谢你的建议', 'success')
    type.value = 'suggestion'
    content.value = ''
    contact.value = ''
    await loadHistory()
  } catch (e) {
    error.value = (e as Error).message || '提交失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
onMounted(loadHistory)
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="mx-auto max-w-2xl px-md">
      <RouterLink to="/" class="text-body-sm text-ink-muted hover:text-pine-deep">← 返回首页</RouterLink>
      <h1 class="mt-md font-serif text-headline-lg-mobile text-pine-deep md:text-headline-lg">意见反馈</h1>
      <p class="mt-2xs text-body-sm text-ink-muted">
        你的每一条建议都会被认真阅读。我们会持续改进，让阅读体验更好。
      </p>

      <section class="mt-lg rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">反馈类型</label>
          <div class="grid grid-cols-3 gap-sm">
            <button
              v-for="t in FEEDBACK_TYPES"
              :key="t"
              type="button"
              class="rounded border px-sm py-sm text-body-sm transition-colors"
              :class="
                type === t
                  ? 'border-pine-deep bg-pine-subtle text-pine-deep'
                  : 'border-hairline text-ink-secondary hover:border-border-muted'
              "
              @click="type = t"
            >
              {{ FEEDBACK_TYPE_LABELS[t] }}
            </button>
          </div>
        </div>

        <div class="mt-md space-y-2xs">
          <label class="text-label-md text-ink-muted">反馈内容 *</label>
          <BaseTextarea
            v-model="content"
            :rows="5"
            :placeholder="'请描述你遇到的问题或希望增加的功能（至少 5 字，最多 1000 字）'"
          />
          <p class="text-right text-label-sm text-ink-faint">{{ content.length }} / {{ MAX }}</p>
        </div>

        <div class="mt-md space-y-2xs">
          <label class="text-label-md text-ink-muted">联系方式（选填）</label>
          <BaseInput
            v-model="contact"
            placeholder="手机号或邮箱，便于我们在需要时与你联系"
          />
        </div>

        <p v-if="error" class="mt-sm text-body-sm text-danger">{{ error }}</p>

        <div class="mt-lg">
          <BaseButton :disabled="submitting" type="button" @click="submit">
            {{ submitting ? '提交中…' : '提交反馈' }}
          </BaseButton>
        </div>
      </section>

      <section class="mt-xl">
        <h2 class="text-title-lg text-ink-primary">我的反馈</h2>
        <p v-if="loadingHistory" class="mt-sm text-body-sm text-ink-muted">加载中…</p>
        <BaseEmpty
          v-else-if="!history.length"
          title="暂无反馈记录"
          description="提交后可在本页查看处理进度与官方回复"
        />
        <ul v-else class="mt-sm space-y-sm">
          <li
            v-for="item in history"
            :key="item.id"
            class="rounded-lg border border-hairline bg-paper-elevated p-md shadow-level-1"
          >
            <div class="flex items-center justify-between">
              <span class="rounded bg-paper-warm px-xs py-0.5 text-label-sm text-ink-muted">
                {{ FEEDBACK_TYPE_LABELS[item.type] }}
              </span>
              <span class="text-label-sm text-ink-faint">{{ fmt(item.createdAt) }}</span>
            </div>
            <p class="mt-xs whitespace-pre-wrap text-body-sm text-ink-primary">{{ item.content }}</p>
            <p class="mt-xs text-label-sm text-pine-deep">
              状态：{{ FEEDBACK_STATUS_LABELS[item.status] }}
            </p>
            <div
              v-if="item.reply"
              class="mt-xs rounded border border-hairline bg-paper-warm px-sm py-xs"
            >
              <p class="text-label-sm text-ink-muted">官方回复</p>
              <p class="mt-0.5 whitespace-pre-wrap text-body-sm text-ink-secondary">{{ item.reply }}</p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
