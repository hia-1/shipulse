<script setup lang="ts">
/**
 * 分享弹窗（P2-05）
 * 打开即调用 POST /share 生成卡片与短码；支持复制分享链接、导出卡片 PNG。
 */
import { ref, watch } from 'vue'
import { BaseButton, BaseModal } from '@/components/base'
import { showToast } from '@/composables/useToast'
import { createShare, type ShareCardPayload, type ShareType } from '@/api/share'
import ShareCard from './ShareCard.vue'

const props = defineProps<{
  open: boolean
  type: ShareType
  targetId: number
  title?: string
}>()

const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const error = ref('')
const card = ref<ShareCardPayload | null>(null)
const link = ref('')
const saving = ref(false)
const cardRef = ref<InstanceType<typeof ShareCard> | null>(null)

async function generate() {
  loading.value = true
  error.value = ''
  card.value = null
  link.value = ''
  try {
    const res = await createShare(props.type, props.targetId)
    card.value = res.data.card
    link.value = `${window.location.origin}/s/${res.data.code}`
  } catch (e) {
    error.value = (e as Error).message || '生成分享卡片失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.open, props.type, props.targetId],
  () => {
    if (props.open) void generate()
  },
  { immediate: true },
)

async function copyLink() {
  if (!link.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link.value)
    } else {
      const ta = document.createElement('textarea')
      ta.value = link.value
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('分享链接已复制', 'success')
  } catch {
    showToast('复制失败，请手动复制链接', 'error')
  }
}

async function saveImage() {
  if (!cardRef.value) return
  saving.value = true
  try {
    const dataUrl = await cardRef.value.toDataURL()
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `时脉书社_${props.type}_分享卡片.png`
    a.click()
  } catch (e) {
    showToast((e as Error).message || '保存图片失败', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" :title="title || '分享'" @close="emit('close')">
    <div v-if="loading" class="py-xl text-center text-body-md text-ink-muted">
      正在生成分享卡片…
    </div>

    <div v-else-if="error" class="py-lg text-center">
      <p class="text-body-md text-danger">{{ error }}</p>
      <BaseButton variant="ghost" class="mt-md" @click="generate">重试</BaseButton>
    </div>

    <template v-else-if="card">
      <ShareCard ref="cardRef" :card="card" />
      <p class="mt-sm break-all text-label-sm text-ink-muted">{{ link }}</p>
    </template>

    <template #footer>
      <div class="flex gap-sm">
        <BaseButton variant="ghost" class="flex-1" :disabled="!card" @click="copyLink">
          复制链接
        </BaseButton>
        <BaseButton class="flex-1" :disabled="!card || saving" @click="saveImage">
          {{ saving ? '导出中…' : '保存图片' }}
        </BaseButton>
      </div>
    </template>
  </BaseModal>
</template>
