import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

export interface AdminRouteMeta {
  title?: string
  icon?: string
  /** 需要的权限点；缺省表示登录即可见 */
  permission?: string
  hidden?: boolean
}

export const adminRoutes = [
  {
    path: 'dashboard',
    name: 'admin-dashboard',
    component: () => import('@/views/dashboard/DashboardView.vue'),
    meta: { title: '数据看板', icon: 'Odometer', permission: 'dashboard:view' },
  },
  {
    path: 'users',
    name: 'admin-users',
    component: () => import('@/views/users/UserManagementView.vue'),
    meta: { title: '用户管理', icon: 'User', permission: 'user:read' },
  },
  {
    path: 'books',
    name: 'admin-books',
    component: () => import('@/views/books/BookManagementView.vue'),
    meta: { title: '书库管理', icon: 'Collection', permission: 'book:*' },
  },
  {
    path: 'moderation',
    name: 'admin-moderation',
    component: () => import('@/views/moderation/ModerationView.vue'),
    meta: { title: '内容审核', icon: 'Stamp', permission: 'review:audit' },
  },
  {
    path: 'reports',
    name: 'admin-reports',
    component: () => import('@/views/moderation/ReportsView.vue'),
    meta: { title: '举报与申诉', icon: 'Warning', permission: 'report:*' },
  },
  {
    path: 'events',
    name: 'admin-events',
    component: () => import('@/views/events/EventManagementView.vue'),
    meta: { title: '活动与共读营', icon: 'Calendar', permission: 'event:*' },
  },
  {
    path: 'operations',
    name: 'admin-operations',
    component: () => import('@/views/operations/OperationsView.vue'),
    meta: { title: '运营管理', icon: 'Promotion', permission: 'banner:*' },
  },
  {
    path: 'finance',
    name: 'admin-finance',
    component: () => import('@/views/finance/FinanceView.vue'),
    meta: { title: '会员订单与财务', icon: 'Money', permission: 'order:*' },
  },
  {
    path: 'settings',
    name: 'admin-settings',
    component: () => import('@/views/settings/SettingsView.vue'),
    meta: { title: '系统设置', icon: 'Setting', permission: 'user:read' },
  },
]

const router = createRouter({
  history:
    import.meta.env.VITE_DEMO === '1'
      ? createWebHashHistory()
      : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/LoginView.vue'),
      meta: { title: '登录', guestOnly: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      redirect: '/dashboard',
      children: adminRoutes,
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: '404' },
    },
  ],
})

router.beforeEach(async (to) => {
  const adminStore = useAdminStore()
  const loggedIn = await adminStore.restore()

  if (to.meta.guestOnly && loggedIn) {
    return { name: 'admin-dashboard' }
  }
  if (!to.meta.guestOnly && !loggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // 权限守卫：路由声明了权限点但角色不满足 → 跳数据看板
  const permission = (to.meta as AdminRouteMeta).permission
  if (loggedIn && permission && !adminStore.hasPermission(permission)) {
    return { name: 'admin-dashboard' }
  }
})

export default router