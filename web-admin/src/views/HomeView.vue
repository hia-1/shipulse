<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'

const health = ref<Record<string, unknown> | null>(null)
const error = ref('')

onMounted(async () => {
  try {
    const res = await axios.get('/health', { baseURL: '' })
    health.value = res.data
  } catch (e) {
    error.value = '后端未启动或不可达（请先启动 backend）'
  }
})
</script>

<template>
  <div class="page">
    <el-card class="box">
      <template #header>
        <span class="title">时脉书社 · 管理端</span>
      </template>
      <el-alert
        v-if="health"
        type="success"
        :closable="false"
        :title="`后端健康检查通过：${JSON.stringify(health)}`"
      />
      <el-alert v-else-if="error" type="error" :closable="false" :title="error" />
      <el-alert v-else type="info" :closable="false" title="正在检查后端连接…" />
      <p class="hint">脚手架占位页：登录/布局/权限将在 P0-06 管理端地基任务中实现。</p>
    </el-card>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
.box {
  width: 480px;
}
.title {
  font-weight: 600;
  color: #2d4a43;
}
.hint {
  margin-top: 16px;
  font-size: 12px;
  color: #909399;
}
</style>
