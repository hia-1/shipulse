<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { BaseButton, BaseInput, BaseTextarea, BaseEmpty } from '@/components/base'
import { showToast } from '@/composables/useToast'
import {
  listMyAppeals,
  submitAppeal,
  REPORT_TARGETS,
  REPORT_TARGET_LABELS,
  type AppealItem,
  type ReportTarget,
} from '@/api/report'

const route = useRoute()

const appeals = ref<AppealItem[]>([])
const total = ref(0)
const loading = ref(false)
const loadError = ref('')
const page = ref(1)
const PAGE_SIZE = 10

const form = ref<{ targetType: ReportTarget; targetId: string; reason: string }>({
  targetType: 'review',
  targetId: '',
  reason: '',
})
const submitting = ref(false)
const formError = ref('')

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: '待复核', cls: 'text-gold-patina bg-gold-tint' },
  approved: { label: '已通过', cls: 'text-pine-deep bg-pine-subtle' },
  rejected: { label: '未通过', cls: 'text-ink-muted bg-paper-warm' },
}

function statusMeta(s: string) {
  return STATUS_META[s] ?? { label: s, cls: 'text-ink-muted bg-paper-warm' }
}

const hasMore = computed(() => appeals.value.length < total.value)

async function load(reset = true) {
  const target = reset ? 1 : page.value + 1
  loading.value = true
  loadError.value = ''
  try {
    const res = await listMyAppeals(target, PAGE_SIZE)
    appeals.value = reset ? res.data.items : [...appeals.value, ...res.data.items]
    total.value = res.data.total
    page.value = target
  } catch (e) {
    if (reset) loadError.value = (e as Error).message || '申诉记录加载失败'
    else showToast((e as Error).message || '加载失败', 'error')
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (!form.value.targetId.trim()) {
    formError.value = '请填写被处罚对象的 ID'
    return
  }
  if (!form.value.reason.trim()) {
    formError.value = '请填写申诉理由'
    return
  }
  submitting.value = true
  formError.value = ''
  try {
    await submitAppeal({
      targetType: form.value.targetType,
      targetId: form.value.targetId.trim(),
      reason: form.value.reason.trim(),
    })
    showToast('申诉已提交，请等待人工复核', 'success')
    form.value = { targetType: 'review', targetId: '', reason: '' }
    await load(true)
  } catch (e) {
    formError.value = (e as Error).message || '申诉提交失败'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (route.query.targetType) {
    form.value.targetType = String(route.query.targetType) as ReportTarget
  }
  if (route.query.targetId) form.value.targetId = String(route.query.targetId)
  load(true)
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <h1 class="font-serif text-headline-lg-mobile md:text-headline-lg text-pine-deep">违规申诉</h1>

        <!-- 提交申诉 -->
        <div class="rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 space-y-md">
          <div class="space-y-2xs">
            <h2 class="text-title-md text-ink-primary">提交申诉</h2>
            <p class="text-body-sm text-ink-muted">
              若你的内容被删除或账号被处罚，可在此提交申诉，我们会人工复核并告知结果。
            </p>
          </div>

          <form class="space-y-md" @submit.prevent="submit">
            <div class="space-y-2xs">
              <label class="text-label-md text-ink-muted">处罚对象类型 *</label>
              <div class="grid grid-cols-3 gap-sm">
                <button
                  v-for="t in REPORT_TARGETS"
                  :key="t"
                  type="button"
                  class="rounded border px-sm py-sm text-body-sm transition-colors"
                  :class="form.targetType === t
                    ? 'border-pine-deep text-pine-deep bg-pine-subtle'
                    : 'border-hairline text-ink-secondary hover:border-border-muted'"
                  @click="form.targetType = t"
                >
                  {{ REPORT_TARGET_LABELS[t] }}
                </button>
              </div>
            </div>

            <div class="space-y-2xs">
              <label class="text-label-md text-ink-muted">对象 ID *</label>
              <BaseInput v-model="form.targetId" inputmode="numeric" placeholder="如书评 ID、动态 ID 或用户 ID" />
            </div>

            <div class="space-y-2xs">
              <label class="text-label-md text-ink-muted">申诉理由 *</label>
              <BaseTextarea
                v-model="form.reason"
                :rows="4"
                placeholder="请说明你的申诉理由（500字以内），如内容并未违规、被误判等"
              />
            </div>

            <p v-if="formError" class="text-body-sm text-danger">{{ formError }}</p>

            <BaseButton class="w-full" type="submit" :disabled="submitting">
              {{ submitting ? '提交中…' : '提交申诉' }}
            </BaseButton>
          </form>
        </div>

        <!-- 我的申诉 -->
        <div class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 overflow-hidden">
          <div class="flex items-center justify-between border-b border-hairline px-lg py-md">
            <h2 class="text-title-md text-ink-primary">我的申诉</h2>
            <span class="text-label-md text-ink-muted">共 {{ total }} 条</span>
          </div>

          <div v-if="loadError" class="p-lg text-center">
            <p class="text-body-sm text-danger">{{ loadError }}</p>
            <BaseButton variant="ghost" class="mt-sm" @click="load(true)">重试</BaseButton>
          </div>
          <div v-else-if="loading && appeals.length === 0" class="py-xl text-center text-body-sm text-ink-muted">加载中…</div>
          <BaseEmpty
            v-else-if="appeals.length === 0"
            title="暂无申诉记录"
            description="如遇处罚不公，可在上方提交申诉"
          />
          <template v-else>
            <ul class="divide-y divide-hairline px-lg">
              <li v-for="a in appeals" :key="a.id" class="py-md space-y-xs">
                <div class="flex items-center justify-between gap-sm">
                  <span class="text-body-md text-ink-primary">
                    {{ REPORT_TARGET_LABELS[a.targetType] || a.targetType }} #{{ a.targetId }}
                  </span>
                  <span class="shrink-0 rounded-full px-2 py-0.5 text-label-sm" :class="statusMeta(a.status).cls">
                    {{ statusMeta(a.status).label }}
                  </span>
                </div>
                <p class="text-body-sm text-ink-secondary whitespace-pre-line">{{ a.reason }}</p>
                <p v-if="a.reviewResult" class="text-label-sm text-ink-muted">复核意见：{{ a.reviewResult }}</p>
                <p class="text-label-sm text-ink-muted">
                  提交于 {{ new Date(a.createdAt).toLocaleString('zh-CN') }}
                  <template v-if="a.reviewedAt"> · 复核于 {{ new Date(a.reviewedAt).toLocaleString('zh-CN') }}</template>
                </p>
              </li>
            </ul>
            <div v-if="hasMore" class="px-lg pb-lg">
              <BaseButton variant="ghost" class="w-full" :disabled="loading" @click="load(false)">
                {{ loading ? '加载中…' : '加载更多' }}
              </BaseButton>
            </div>
          </template>
        </div>
      </div>
    </div>
  </main>
</template>
