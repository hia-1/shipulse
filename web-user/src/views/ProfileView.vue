<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNotificationStore } from '@/stores/notification'
import { confirmDialog } from '@/composables/useConfirm'
import { BaseButton, BaseModal, BaseInput, BaseTextarea, BaseEmpty } from '@/components/base'
import Stars from '@/components/review/Stars.vue'
import BadgeWall from '@/components/incentive/BadgeWall.vue'
import { listMyReviews, deleteReview, type ReviewItem } from '@/api/review'
import { listSessions, type SessionSummary } from '@/api/reading'
import { getAllBadges, checkBadges, type BadgeItem } from '@/api/incentive'
import { updateProfile, cancelAccount } from '@/api/user'

const router = useRouter()
const userStore = useUserStore()
const notiStore = useNotificationStore()

// ---- 资料编辑 ----
const editOpen = ref(false)
const editing = ref({ nickname: '', gender: 0, bio: '' })
const saving = ref(false)
const editError = ref('')

function openEdit() {
  const u = userStore.user
  if (!u) return
  editing.value = { nickname: u.nickname, gender: u.gender, bio: u.bio || '' }
  editError.value = ''
  editOpen.value = true
}

async function submitEdit() {
  if (!editing.value.nickname.trim()) {
    editError.value = '昵称不能为空'
    return
  }
  saving.value = true
  editError.value = ''
  try {
    await updateProfile({
      nickname: editing.value.nickname.trim(),
      gender: editing.value.gender,
      bio: editing.value.bio.trim(),
    })
    await userStore.fetchProfile()
    editOpen.value = false
  } catch (e) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

// ---- 注销账号 ----
const cancelOpen = ref(false)
const cancelText = ref('')
const cancelling = ref(false)
const cancelError = ref('')

function openCancel() {
  cancelText.value = ''
  cancelError.value = ''
  cancelOpen.value = true
}

async function submitCancel() {
  if (cancelText.value.trim() !== userStore.user?.nickname) {
    cancelError.value = '请输入昵称以确认注销'
    return
  }
  cancelling.value = true
  cancelError.value = ''
  try {
    await cancelAccount(true)
    userStore.logout()
    cancelOpen.value = false
    router.push('/')
  } catch (e) {
    cancelError.value = (e as Error).message || '注销失败'
  } finally {
    cancelling.value = false
  }
}

// ---- 书评 / 阅读记录 / 徽章 ----
const activeTab = ref<'reviews' | 'sessions' | 'badges'>('reviews')

const reviews = ref<ReviewItem[]>([])
const reviewsTotal = ref(0)
const reviewsLoading = ref(false)
const reviewsError = ref('')
const reviewPage = ref(1)
const PAGE_SIZE = 10

const sessions = ref<SessionSummary[]>([])
const sessionsTotal = ref(0)
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sessionPage = ref(1)

const badges = ref<BadgeItem[]>([])
const badgesLoaded = ref(false)
const badgesLoading = ref(false)
const badgesError = ref('')

const profileError = ref('')

const reviewsHasMore = computed(() => reviews.value.length < reviewsTotal.value)
const sessionsHasMore = computed(() => sessions.value.length < sessionsTotal.value)

const GENDER = ['未知', '男', '女']

const AUDIT_META: Record<string, { label: string; cls: string }> = {
  approved: { label: '已发布', cls: 'text-pine-deep bg-pine-subtle' },
  pending: { label: '审核中', cls: 'text-gold-patina bg-gold-tint' },
  rejected: { label: '未通过', cls: 'text-ink-muted bg-paper-warm' },
}

function auditMeta(status: string) {
  return AUDIT_META[status] ?? { label: status, cls: 'text-ink-muted bg-paper-warm' }
}

function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return `${h}小时${m}分`
  return `${m}分钟`
}

async function loadReviews(page = 1) {
  reviewsLoading.value = true
  reviewsError.value = ''
  try {
    const res = await listMyReviews(page, PAGE_SIZE)
    if (page === 1) reviews.value = res.data.list
    else reviews.value = [...reviews.value, ...res.data.list]
    reviewsTotal.value = res.data.total
    reviewPage.value = page
  } catch (e) {
    reviewsError.value = (e as Error).message || '书评加载失败'
  } finally {
    reviewsLoading.value = false
  }
}

async function loadSessions(page = 1) {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    const res = await listSessions(page, PAGE_SIZE)
    if (page === 1) sessions.value = res.data.list
    else sessions.value = [...sessions.value, ...res.data.list]
    sessionsTotal.value = res.data.total
    sessionPage.value = page
  } catch (e) {
    sessionsError.value = (e as Error).message || '阅读记录加载失败'
  } finally {
    sessionsLoading.value = false
  }
}

function switchTab(tab: 'reviews' | 'sessions' | 'badges') {
  activeTab.value = tab
  if (tab === 'reviews' && reviews.value.length === 0) loadReviews(1)
  else if (tab === 'sessions' && sessions.value.length === 0) loadSessions(1)
  else if (tab === 'badges' && !badgesLoaded.value) loadBadges()
}

async function loadBadges() {
  badgesLoading.value = true
  badgesError.value = ''
  try {
    const res = await getAllBadges()
    badges.value = res.data
    badgesLoaded.value = true
  } catch (e) {
    badgesError.value = (e as Error).message || '徽章加载失败'
  } finally {
    badgesLoading.value = false
  }
}

async function handleDeleteReview(id: number) {
  if (!(await confirmDialog({ message: '确定删除这条书评吗？', danger: true, confirmText: '删除' }))) return
  try {
    await deleteReview(id)
    await userStore.fetchProfile()
    await loadReviews(1)
  } catch {
    /* 忽略删除失败提示 */
  }
}

function handleLogout() {
  userStore.logout()
  notiStore.reset()
  router.push('/')
}

async function reloadProfile() {
  profileError.value = ''
  try {
    await userStore.fetchProfile()
  } catch (e) {
    profileError.value = (e as Error).message || '个人资料加载失败'
  }
}

onMounted(async () => {
  await reloadProfile()
  loadReviews(1)
  loadSessions(1)
})
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <!-- 标题 -->
        <h1 class="text-headline-lg-mobile md:text-headline-lg font-serif text-pine-deep">个人中心</h1>

        <!-- 概览卡片 -->
        <div v-if="userStore.user" class="rounded-lg bg-paper-elevated shadow-level-1 border border-hairline p-lg space-y-md">
          <div class="flex items-center gap-md">
            <div class="w-16 h-16 rounded-full bg-pine-subtle flex items-center justify-center text-pine-deep text-title-lg font-serif shrink-0">
              {{ userStore.user.nickname.charAt(0) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-xs">
                <p class="text-title-md text-ink-primary truncate">{{ userStore.user.nickname }}</p>
                <span v-if="userStore.user.isMember" class="shrink-0 rounded-full bg-gold-tint px-2 py-0.5 text-label-sm text-gold-patina">会员</span>
              </div>
              <p class="text-body-sm text-ink-muted">{{ userStore.user.phone }}</p>
            </div>
            <BaseButton variant="ghost" class="shrink-0" @click="openEdit">编辑</BaseButton>
          </div>

          <!-- 统计 -->
          <div class="grid grid-cols-3 gap-sm border-t border-hairline pt-md text-center">
            <div>
              <p class="text-title-lg text-pine-deep">{{ userStore.user.bookCount }}</p>
              <p class="text-body-sm text-ink-muted">在读图书</p>
            </div>
            <div>
              <p class="text-title-lg text-pine-deep">{{ userStore.user.reviewCount }}</p>
              <p class="text-body-sm text-ink-muted">发表书评</p>
            </div>
            <div>
              <p class="text-title-lg text-pine-deep">{{ userStore.user.followingCount }}</p>
              <p class="text-body-sm text-ink-muted">关注</p>
            </div>
          </div>

          <!-- 信息字段 -->
          <div class="border-t border-hairline pt-md space-y-sm">
            <div class="flex justify-between">
              <span class="text-body-sm text-ink-muted">性别</span>
              <span class="text-body-sm text-ink-primary">{{ GENDER[userStore.user.gender] }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-body-sm text-ink-muted">会员到期</span>
              <span class="text-body-sm text-ink-primary">
                {{ userStore.user.memberExpireAt ? new Date(userStore.user.memberExpireAt).toLocaleDateString('zh-CN') : '—' }}
              </span>
            </div>
            <div v-if="userStore.user.bio" class="flex justify-between gap-md">
              <span class="text-body-sm text-ink-muted shrink-0">简介</span>
              <span class="text-body-sm text-ink-primary text-right">{{ userStore.user.bio }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-body-sm text-ink-muted">注册时间</span>
              <span class="text-body-sm text-ink-primary">{{ new Date(userStore.user.createdAt).toLocaleDateString('zh-CN') }}</span>
            </div>
          </div>
        </div>
        <div v-else-if="profileError" class="text-center py-xl text-body-md text-danger">
          <p>{{ profileError }}</p>
          <BaseButton variant="ghost" class="mt-sm" @click="reloadProfile">重试</BaseButton>
        </div>
        <div v-else class="text-center py-xl text-ink-muted text-body-md">加载中…</div>

        <!-- 会员入口 -->
        <RouterLink
          v-if="userStore.user"
          to="/membership"
          class="flex items-center justify-between rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep"
        >
          <div>
            <p class="text-body-md text-ink-primary font-medium">时脉会员</p>
            <p class="text-body-sm text-ink-muted">
              {{ userStore.user.isMember
                ? (userStore.user.memberExpireAt
                    ? `有效期至 ${new Date(userStore.user.memberExpireAt).toLocaleDateString('zh-CN')}`
                    : '已开通会员')
                : '开通享深度时脉报告与数据导出' }}
            </p>
          </div>
          <span class="text-pine-deep">→</span>
        </RouterLink>

        <!-- 功能入口 -->
        <div v-if="userStore.user" class="grid grid-cols-3 gap-sm">
          <RouterLink to="/notifications" class="relative rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">消息</span>
            <span
              v-if="notiStore.unread.total > 0"
              class="absolute right-2 top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-label-sm text-paper-elevated"
            >
              {{ notiStore.unread.total > 99 ? '99+' : notiStore.unread.total }}
            </span>
          </RouterLink>
          <RouterLink to="/reading-room" class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">书房</span>
          </RouterLink>
          <RouterLink to="/bookshelf" class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">书架</span>
          </RouterLink>
          <RouterLink to="/pulse-report" class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">时脉</span>
          </RouterLink>
          <RouterLink to="/booklists/square" class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">书单</span>
          </RouterLink>
          <RouterLink to="/appeals" class="rounded-lg bg-paper-elevated border border-hairline p-md text-center shadow-level-1 transition-all hover:shadow-level-2 hover:border-pine-deep">
            <span class="text-body-md text-pine-deep font-medium">申诉</span>
          </RouterLink>
        </div>

        <!-- 记录 / 书评 / 徽章 -->
        <div v-if="userStore.user" class="rounded-lg bg-paper-elevated shadow-level-1 border border-hairline overflow-hidden">
          <div class="grid grid-cols-3 border-b border-hairline">
            <button
              type="button"
              class="py-md text-body-md transition-colors"
              :class="activeTab === 'reviews' ? 'text-pine-deep font-medium border-b-2 border-pine-deep -mb-px' : 'text-ink-muted'"
              @click="switchTab('reviews')"
            >
              书评
            </button>
            <button
              type="button"
              class="py-md text-body-md transition-colors"
              :class="activeTab === 'sessions' ? 'text-pine-deep font-medium border-b-2 border-pine-deep -mb-px' : 'text-ink-muted'"
              @click="switchTab('sessions')"
            >
              阅读记录
            </button>
            <button
              type="button"
              class="py-md text-body-md transition-colors"
              :class="activeTab === 'badges' ? 'text-pine-deep font-medium border-b-2 border-pine-deep -mb-px' : 'text-ink-muted'"
              @click="switchTab('badges')"
            >
              徽章
            </button>
          </div>

          <!-- 书评列表 -->
          <div v-if="activeTab === 'reviews'">
            <div v-if="reviewsError" class="p-lg text-center">
              <p class="text-body-sm text-danger">{{ reviewsError }}</p>
              <BaseButton variant="ghost" class="mt-sm" @click="loadReviews(1)">重试</BaseButton>
            </div>
            <div v-else-if="reviewsLoading && reviews.length === 0" class="py-xl text-center text-body-sm text-ink-muted">加载中…</div>
            <BaseEmpty v-else-if="reviews.length === 0" title="还没有书评" description="去书籍详情页写下你的第一篇书评吧" />
            <ul v-else class="divide-y divide-hairline px-lg">
              <li v-for="r in reviews" :key="r.id" class="py-md">
                <RouterLink :to="`/reviews/${r.id}`" class="flex gap-sm">
                  <img v-if="r.coverUrl" :src="r.coverUrl" alt="" class="w-12 h-16 object-cover rounded border border-hairline shrink-0" />
                  <div v-else class="w-12 h-16 rounded border border-hairline bg-paper-warm flex items-center justify-center text-ink-faint text-label-md shrink-0">无图</div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-xs">
                      <p class="text-body-md text-ink-primary font-medium truncate">{{ r.bookTitle }}</p>
                      <span class="shrink-0 rounded-full px-2 py-0.5 text-label-sm" :class="auditMeta(r.audit?.status || r.auditStatus).cls">
                        {{ auditMeta(r.audit?.status || r.auditStatus).label }}
                      </span>
                    </div>
                    <div class="flex items-center gap-xs mt-1">
                      <Stars :value="r.rating" :size="13" />
                      <span class="text-label-sm text-ink-muted">{{ r.rating }}分</span>
                    </div>
                    <p v-if="r.content" class="text-body-sm text-ink-secondary mt-1 truncate">{{ r.content }}</p>
                    <p class="text-label-sm text-ink-muted mt-1">
                      {{ new Date(r.createdAt).toLocaleDateString('zh-CN') }}
                      · {{ r.likeCount }} 赞
                      · {{ r.commentCount }} 评论
                    </p>
                  </div>
                </RouterLink>
                <div class="mt-2 flex justify-end">
                  <BaseButton variant="text" class="text-ink-muted" @click="handleDeleteReview(r.id)">删除</BaseButton>
                </div>
              </li>
            </ul>
            <div v-if="!reviewsError && reviewsHasMore" class="px-lg pb-lg">
              <BaseButton variant="ghost" class="w-full" :disabled="reviewsLoading" @click="loadReviews(reviewPage + 1)">
                {{ reviewsLoading ? '加载中…' : '加载更多' }}
              </BaseButton>
            </div>
          </div>

          <!-- 阅读记录列表 -->
          <div v-if="activeTab === 'sessions'">
            <div v-if="sessionsError" class="p-lg text-center">
              <p class="text-body-sm text-danger">{{ sessionsError }}</p>
              <BaseButton variant="ghost" class="mt-sm" @click="loadSessions(1)">重试</BaseButton>
            </div>
            <div v-else-if="sessionsLoading && sessions.length === 0" class="py-xl text-center text-body-sm text-ink-muted">加载中…</div>
            <BaseEmpty v-else-if="sessions.length === 0" title="还没有阅读记录" description="到书房开始一次专注阅读吧" />
            <ul v-else class="divide-y divide-hairline px-lg">
              <li v-for="s in sessions" :key="s.sessionId" class="py-md">
                <div class="flex gap-sm">
                  <img v-if="s.coverUrl" :src="s.coverUrl" alt="" class="w-12 h-16 object-cover rounded border border-hairline shrink-0" />
                  <div v-else class="w-12 h-16 rounded border border-hairline bg-paper-warm flex items-center justify-center text-ink-faint text-label-md shrink-0">无图</div>
                  <div class="min-w-0 flex-1">
                    <p class="text-body-md text-ink-primary font-medium truncate">{{ s.bookTitle }}</p>
                    <p class="text-body-sm text-ink-secondary mt-1">时长 {{ fmtDuration(s.durationSeconds) }}</p>
                    <p class="text-label-sm text-ink-muted mt-1">
                      {{ new Date(s.startTime).toLocaleString('zh-CN') }}
                      <template v-if="s.endPage && s.startPage"> · 第 {{ s.startPage }}–{{ s.endPage }} 页</template>
                    </p>
                    <p v-if="s.note" class="text-label-sm text-ink-muted mt-1 truncate">📝 {{ s.note }}</p>
                  </div>
                </div>
              </li>
            </ul>
            <div v-if="!sessionsError && sessionsHasMore" class="px-lg pb-lg">
              <BaseButton variant="ghost" class="w-full" :disabled="sessionsLoading" @click="loadSessions(sessionPage + 1)">
                {{ sessionsLoading ? '加载中…' : '加载更多' }}
              </BaseButton>
            </div>
          </div>

          <!-- 徽章墙 -->
          <div v-if="activeTab === 'badges'" class="p-lg">
            <div v-if="badgesError" class="text-center">
              <p class="text-body-sm text-danger">{{ badgesError }}</p>
              <BaseButton variant="ghost" class="mt-sm" @click="loadBadges">重试</BaseButton>
            </div>
            <div v-else-if="badgesLoading" class="py-lg text-center text-body-sm text-ink-muted">加载中…</div>
            <BadgeWall v-else :badges="badges" />
          </div>
        </div>

        <!-- 底部操作 -->
        <div v-if="userStore.user" class="space-y-sm">
          <BaseButton variant="ghost" class="w-full" @click="handleLogout">退出登录</BaseButton>
          <BaseButton variant="ghost" class="w-full text-danger" @click="openCancel">注销账号</BaseButton>
        </div>
      </div>
    </div>

    <!-- 编辑资料弹窗 -->
    <BaseModal :open="editOpen" title="编辑个人资料" @close="editOpen = false">
      <form class="space-y-md" @submit.prevent="submitEdit">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">昵称</label>
          <BaseInput v-model="editing.nickname" placeholder="请输入昵称" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">性别</label>
          <div class="flex gap-sm">
            <button v-for="(label, i) in GENDER" :key="i" type="button"
              class="flex-1 rounded border px-sm py-sm text-body-md transition-colors"
              :class="editing.gender === i ? 'border-pine-deep text-pine-deep bg-pine-subtle' : 'border-hairline text-ink-secondary hover:border-border-muted'"
              @click="editing.gender = i">
              {{ label }}
            </button>
          </div>
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">个人简介</label>
          <BaseTextarea v-model="editing.bio" placeholder="介绍一下自己（200字以内）" :rows="3" />
        </div>
        <p v-if="editError" class="text-body-sm text-danger">{{ editError }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="editOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- 注销账号弹窗 -->
    <BaseModal :open="cancelOpen" title="注销账号" @close="cancelOpen = false">
      <form class="space-y-md" @submit.prevent="submitCancel">
        <div class="rounded border border-danger/30 bg-danger/5 p-md text-body-sm text-ink-secondary space-y-xs">
          <p>注销后将无法登录，你的书架、书评与阅读记录将一并清除。此操作不可恢复。</p>
          <p>请输入昵称 <span class="font-medium text-ink-primary">{{ userStore.user?.nickname }}</span> 以确认。</p>
        </div>
        <BaseInput v-model="cancelText" placeholder="输入昵称确认注销" />
        <p v-if="cancelError" class="text-body-sm text-danger">{{ cancelError }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="cancelOpen = false">取消</BaseButton>
          <BaseButton class="flex-1 text-danger" type="submit" :disabled="cancelling">{{ cancelling ? '注销中…' : '确认注销' }}</BaseButton>
        </div>
      </form>
    </BaseModal>
  </main>
</template>