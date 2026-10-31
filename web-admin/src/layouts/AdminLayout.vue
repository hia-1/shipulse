<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAdminStore } from '@/stores/admin'
import { adminRoutes, type AdminRouteMeta } from '@/router'
import { ROLES } from '@/permission/roles'

const route = useRoute()
const router = useRouter()
const adminStore = useAdminStore()

const collapsed = ref(false)

// 按角色权限过滤菜单项
const menus = computed(() => {
  return adminRoutes
    .filter((r) => {
      const perm = (r.meta as AdminRouteMeta).permission
      return !perm || adminStore.hasPermission(perm)
    })
    .map((r) => ({
      path: `/admin-${r.path}` === '' ? '' : `/${r.path}`,
      routePath: r.path,
      name: r.name as string,
      title: (r.meta as AdminRouteMeta).title as string,
      icon: (r.meta as AdminRouteMeta).icon as string,
    }))
})

// 默认展开当前项路径
const activeMenu = computed(() => route.path)

const breadcrumbs = computed(() => {
  const title = (route.meta.title as string) || ''
  return title ? ['管理端', title] : ['管理端']
})

const roleNames = computed(() => {
  if (adminStore.roles.length === 0) return ''
  const names = adminStore.roles
    .map((c) => ROLES[c]?.name)
    .filter(Boolean)
  return names.join('、')
})

async function handleCommand(command: string) {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning',
      })
    } catch {
      return
    }
    adminStore.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  }
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="layout-aside">
      <div class="aside-logo">
        <div class="logo-mark">时</div>
        <span v-show="!collapsed" class="logo-text">时脉管理端</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="aside-menu"
      >
        <el-menu-item v-for="m in menus" :key="m.name" :index="m.routePath">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container class="layout-body">
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed">
            <Expand v-if="collapsed" />
            <Fold v-else />
          </el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(bc, i) in breadcrumbs" :key="i">{{ bc }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-trigger">
              <el-avatar :size="28" class="user-avatar">{{ adminStore.admin?.name?.charAt(0) || 'A' }}</el-avatar>
              <span class="user-name">{{ adminStore.admin?.name || '管理员' }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ roleNames }}</el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.admin-layout {
  height: 100vh;
}
.layout-aside {
  background: #203731;
  border-right: 1px solid rgba(255, 255, 255, 0.06);
  transition: width 0.2s;
  display: flex;
  flex-direction: column;
}
.aside-logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.logo-mark {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 6px;
  background: #fff;
  color: #203731;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}
.logo-text {
  font-weight: 600;
  font-size: 15px;
  white-space: nowrap;
}
.aside-menu {
  flex: 1;
  border-right: none;
  background: transparent;
  --el-menu-bg-color: #203731;
  --el-menu-text-color: #c1cac5;
  --el-menu-hover-bg-color: #2d4a43;
  --el-menu-active-color: #ffffff;
}
.layout-body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.layout-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid #e3e7e5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #4a5753;
}
.header-right {
  display: flex;
  align-items: center;
}
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #22312d;
  outline: none;
}
.user-avatar {
  background: #2d4a43;
  color: #fff;
}
.layout-main {
  padding: 20px;
  overflow: auto;
  background: #f4f6f4;
}
</style>