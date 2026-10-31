import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

// 演示模式（静态托管）使用 hash 路由，避免无 SPA fallback 时刷新 404
const router = createRouter({
  history:
    import.meta.env.VITE_DEMO === '1'
      ? createWebHashHistory()
      : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/books',
      name: 'bookstore',
      component: () => import('@/views/BookstoreView.vue'),
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
    },
    {
      path: '/books/:id',
      name: 'book-detail',
      component: () => import('@/views/BookDetailView.vue'),
    },
    {
      path: '/design',
      name: 'design',
      component: () => import('@/views/DesignView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/bookshelf',
      name: 'bookshelf',
      component: () => import('@/views/BookshelfView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/reading-room',
      name: 'reading-room',
      component: () => import('@/views/ReadingRoomView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pulse-report',
      name: 'pulse-report',
      component: () => import('@/views/PulseReportView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/membership',
      name: 'membership',
      component: () => import('@/views/MembershipView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/booklists/square',
      name: 'booklist-square',
      component: () => import('@/views/BookSquareView.vue'),
    },
    {
      path: '/booklists/:id',
      name: 'booklist-detail',
      component: () => import('@/views/BooklistDetailView.vue'),
    },
    {
      path: '/feed',
      name: 'feed',
      component: () => import('@/views/FeedView.vue'),
    },
    {
      path: '/reviews/:id',
      name: 'review-detail',
      component: () => import('@/views/ReviewDetailView.vue'),
    },
    {
      path: '/appeals',
      name: 'appeals',
      component: () => import('@/views/AppealView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/s/:code',
      name: 'share-landing',
      component: () => import('@/views/ShareLandingView.vue'),
    },
    {
      path: '/feedback',
      name: 'feedback',
      component: () => import('@/views/FeedbackView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/help',
      name: 'help',
      component: () => import('@/views/HelpView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
    },
    {
      path: '/privacy',
      name: 'privacy',
      component: () => import('@/views/legal/LegalView.vue'),
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('@/views/legal/LegalView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const userStore = useUserStore()
  await userStore.restore()

  if (to.meta.requiresAuth && !userStore.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && userStore.isLoggedIn) {
    return { name: 'home' }
  }
})

export default router
