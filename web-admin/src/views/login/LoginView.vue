<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAdminStore } from '@/stores/admin'
import { listRoles } from '@/permission/roles'

const router = useRouter()
const route = useRoute()
const adminStore = useAdminStore()

const isDev = import.meta.env.DEV

const form = reactive({
  username: 'admin',
  password: 'admin123',
})

const errorMsg = ref('')
// dev 环境模拟角色：用于验证超管 / 运营等不同角色的权限菜单差异
const roleOption = ref('super_admin')
const roleOptions = listRoles().map((r) => ({ label: r.name, value: r.code }))

async function handleLogin() {
  errorMsg.value = ''
  if (!form.username || !form.password) {
    errorMsg.value = '请输入用户名和密码'
    return
  }
  try {
    await adminStore.login({ username: form.username, password: form.password })
    if (isDev && roleOption.value !== 'super_admin') {
      // dev 下允许覆盖角色以演示权限差异；非超管时清除其他角色
      adminStore.setRoles([roleOption.value])
    }
    ElMessage.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (e) {
    errorMsg.value = (e as Error).message
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-brand">
        <div class="brand-mark">时</div>
        <div>
          <h1 class="brand-title">时脉书社 · 管理端</h1>
          <p class="brand-sub">Shipulse Admin Console</p>
        </div>
      </div>

      <el-form label-position="top" @submit.prevent="handleLogin">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item v-if="isDev" label="模拟角色（仅开发环境，用于验证权限区分）">
          <el-select v-model="roleOption" size="large" style="width: 100%">
            <el-option v-for="opt in roleOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>

        <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>

        <el-button
          type="primary"
          size="large"
          class="login-btn"
          :loading="adminStore.loading"
          @click="handleLogin"
        >
          登 录
        </el-button>
      </el-form>

      <div class="login-tip">
        <p>默认管理员：admin / admin123</p>
        <p v-if="isDev">角色模拟仅影响前端菜单/权限展示</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #2d4a43 0%, #203731 100%);
  padding: 16px;
}
.login-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 8px;
  padding: 40px 36px 28px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.login-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
}
.brand-mark {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #2d4a43;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}
.brand-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #2d4a43;
}
.brand-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #84968d;
}
.login-btn {
  width: 100%;
  margin-top: 4px;
}
.login-error {
  color: #c0503f;
  font-size: 13px;
  margin: 0 0 12px;
}
.login-tip {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px dashed #d6dcd9;
  text-align: center;
}
.login-tip p {
  margin: 4px 0;
  font-size: 12px;
  color: #84968d;
}
</style>