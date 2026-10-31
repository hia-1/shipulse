<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const router = useRouter()
const adminStore = useAdminStore()

function goHome() {
  router.push(adminStore.isLoggedIn ? '/dashboard' : '/login')
}
</script>

<template>
  <div class="not-found">
    <h1 class="nf-code">404</h1>
    <p class="nf-text">页面不存在或已被移除</p>
    <el-button type="primary" @click="goHome">返回首页</el-button>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #f4f6f4;
}
.nf-code {
  font-size: 72px;
  margin: 0;
  color: #2d4a43;
  font-weight: 700;
}
.nf-text {
  color: #4a5753;
  margin: 0 0 8px;
}
</style>