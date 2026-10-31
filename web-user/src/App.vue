<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import FloatingTimer from '@/components/reading/FloatingTimer.vue'
import EndSessionModal from '@/components/reading/EndSessionModal.vue'
import { BaseToast, BaseConfirm } from '@/components/base'
import { useTimerStore } from '@/stores/timer'
import { useNotificationStore } from '@/stores/notification'

const timer = useTimerStore()
const notifications = useNotificationStore()
const showEndModal = ref(false)

onMounted(() => {
  timer.restore()
  notifications.startPolling()
})

onUnmounted(() => {
  notifications.stopPolling()
})
</script>

<template>
  <RouterView />

  <!-- 全局轻提示（接口错误 / 操作反馈） -->
  <BaseToast />

  <!-- 全局确认弹窗 -->
  <BaseConfirm />

  <!-- 全局悬浮计时器（跨页面持续） -->
  <FloatingTimer @stop="showEndModal = true" />

  <!-- 全局结束计时弹窗 -->
  <EndSessionModal v-model="showEndModal" />
</template>
