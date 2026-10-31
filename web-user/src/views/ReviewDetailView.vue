<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { confirmDialog } from '@/composables/useConfirm'
import {
  getReviewDetail,
  listComments,
  toggleReviewLike,
  createComment,
  deleteReview,
  type ReviewItem,
  type ReviewComment,
} from '@/api/review'
import { BaseButton, BaseInput, BaseEmpty } from '@/components/base'
import Stars from '@/components/review/Stars.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import ShareDialog from '@/components/share/ShareDialog.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const reviewId = computed(() => Number(route.params.id))
const review = ref<ReviewItem | null>(null)
const comments = ref<ReviewComment[]>([])
const loading = ref(true)
const error = ref('')
const commentsError = ref('')

const liking = ref(false)
const commentText = ref('')
const commenting = ref(false)
const commentError = ref('')
const commentNotice = ref('')
const viewComment = ref(0)
const reportOpen = ref(false)
const shareOpen = ref(false)

const time = computed(() => {
  const d = review.value?.publishedAt ?? review.value?.createdAt
  return d ? new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
})

const isAuthor = computed(() => !!userStore.user && userStore.user.id === review.value?.author.id)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getReviewDetail(reviewId.value)
    review.value = res.data
    void loadComments()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function loadComments() {
  commentsError.value = ''
  try {
    const res = await listComments(reviewId.value)
    comments.value = res.data
  } catch (e) {
    comments.value = []
    commentsError.value = (e as Error).message || '评论加载失败'
  }
}

async function onLike() {
  if (!review.value) return
  liking.value = true
  try {
    const res = await toggleReviewLike(review.value.id)
    review.value.isLiked = res.data.isLiked
    review.value.likeCount = res.data.likeCount
  } catch {
    // 点赞失败提示由全局拦截器统一弹出，不影响正文展示
  } finally {
    liking.value = false
  }
}

async function submitComment() {
  commentError.value = ''
  commentNotice.value = ''
  const text = commentText.value.trim()
  if (!text) return
  commenting.value = true
  try {
    const res = await createComment(reviewId.value, { content: text, parentId: viewComment.value || undefined })
    commentText.value = ''
    viewComment.value = 0
    const audit = res.data.audit
    if (audit && audit.status !== 'approved') {
      commentNotice.value =
        audit.status === 'rejected'
          ? '评论包含违规内容，未通过审核'
          : '评论已提交，通过审核后展示'
    } else if (review.value) {
      review.value.commentCount++
    }
    await loadComments()
  } catch (e) {
    commentError.value = (e as Error).message
  } finally {
    commenting.value = false
  }
}

function startReply(to: number) {
  viewComment.value = viewComment.value === to ? 0 : to
}

async function removeMine() {
  if (!review.value) return
  if (!(await confirmDialog({ message: '确定删除这条书评吗？', danger: true, confirmText: '删除' }))) return
  try {
    await deleteReview(review.value.id)
    router.push(`/books/${review.value.bookId}`)
  } catch {
    // 删除失败提示由全局拦截器统一弹出，保留当前页面
  }
}

watch(reviewId, () => load(), { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-paper-warm">
    <main class="mx-auto max-w-container px-md py-xl">
      <!-- 返回书籍 -->
      <p v-if="review" class="max-w-reading mx-auto mb-lg">
        <RouterLink
          :to="`/books/${review.bookId}`"
          class="text-body-sm text-ink-muted hover:text-pine-deep"
        >
          ← 返回《{{ review.bookTitle }}》
        </RouterLink>
      </p>

      <div v-if="loading" class="mx-auto max-w-reading space-y-sm">
        <div v-for="i in 6" :key="i" class="h-4 animate-pulse rounded bg-paper-warm" />
      </div>

      <BaseEmpty v-else-if="error" title="加载失败" :description="error" />

      <!-- 书评正文 -->
      <article v-else-if="review" class="mx-auto max-w-reading rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1 md:p-xl">
        <header class="flex flex-wrap items-center gap-xs">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-pine-subtle font-serif text-pine-deep">
            {{ review.author.nickname.charAt(0) }}
          </span>
          <span class="text-label-md font-medium text-ink-primary">{{ review.author.nickname }}</span>
          <span v-if="review.author.isMember" class="text-label-sm text-gold-patina">会员</span>
          <span v-if="review.isFeatured" class="rounded bg-gold-tint px-1.5 text-label-sm text-gold-patina">官方精选</span>
          <span class="ml-auto text-label-sm text-ink-muted tabular-nums">{{ time }}</span>
        </header>

        <div class="mt-md flex items-center gap-sm">
          <Stars :value="Number(review.rating)" :size="16" />
          <span class="text-title-md text-ink-primary tabular-nums">{{ Number(review.rating).toFixed(1) }}</span>
          <span class="text-label-sm text-ink-faint">《{{ review.bookTitle }}》</span>
        </div>

        <h1 class="mt-md font-serif text-headline-md text-ink-primary">{{ review.title }}</h1>

        <div class="mt-sm whitespace-pre-line text-body-lg leading-relaxed text-ink-primary">
          {{ review.content }}
        </div>

        <!-- 操作栏 -->
        <footer class="mt-lg flex flex-wrap items-center gap-sm border-t border-hairline pt-md">
          <BaseButton variant="ghost" :disabled="liking" @click="onLike">
            <template v-if="review.isLiked">
              <span class="text-pine-deep">♥</span> 已赞 <span class="tabular-nums">{{ review.likeCount }}</span>
            </template>
            <template v-else>
              ♡ 点赞 <span class="tabular-nums">{{ review.likeCount }}</span>
            </template>
          </BaseButton>
          <span v-if="!userStore.isLoggedIn" class="text-label-sm text-ink-faint">登录后可点赞、评论</span>
          <BaseButton variant="ghost" @click="shareOpen = true">分享</BaseButton>
          <BaseButton v-if="isAuthor" variant="text" class="ml-auto" @click="removeMine">删除书评</BaseButton>
          <BaseButton v-else-if="userStore.isLoggedIn" variant="text" class="ml-auto text-ink-muted" @click="reportOpen = true">举报</BaseButton>
        </footer>
      </article>

      <!-- 评论区 -->
      <section v-if="review" class="mx-auto mt-lg max-w-reading">
        <h2 class="text-title-lg text-ink-primary">评论 · {{ review.commentCount }}</h2>

        <div v-if="userStore.isLoggedIn" class="mt-sm flex items-center gap-sm rounded-lg border border-hairline bg-paper-elevated p-sm shadow-level-1">
          <BaseInput v-model="commentText" placeholder="写下你的看法…" />
          <BaseButton :disabled="commenting || !commentText.trim()" @click="submitComment">
            {{ commenting ? '发送中…' : '发送' }}
          </BaseButton>
        </div>

        <div v-if="viewComment" class="mt-xs text-label-sm text-ink-muted">
          正在回复
          <button class="text-pine-deep" @click="viewComment = 0">取消</button>
        </div>

        <p v-if="commentError" class="mt-xs text-body-sm text-danger">{{ commentError }}</p>
        <p v-if="commentNotice" class="mt-xs text-body-sm text-ink-muted">{{ commentNotice }}</p>

        <div v-if="commentsError" class="mt-sm rounded-lg border border-danger/30 bg-danger/5 p-md text-center text-body-sm text-danger">
          <p>{{ commentsError }}</p>
          <BaseButton variant="ghost" class="mt-sm" @click="loadComments">重试</BaseButton>
        </div>

        <div v-else-if="comments.length" class="mt-sm space-y-sm">
          <div
            v-for="c in comments"
            :key="c.id"
            class="rounded-lg border border-hairline bg-paper-elevated p-md shadow-level-1"
            :class="{ 'ml-md': c.parentId > 0 }"
          >
            <div class="flex items-center gap-xs">
              <span class="text-label-md font-medium text-ink-primary">{{ c.author.nickname }}</span>
              <span v-if="c.replyToNickname" class="text-label-sm text-ink-faint">回复 {{ c.replyToNickname }}</span>
              <span class="ml-auto text-label-sm text-ink-muted tabular-nums">
                {{ new Date(c.createdAt).toLocaleDateString('zh-CN') }}
              </span>
            </div>
            <p class="mt-1 whitespace-pre-line text-body-md text-ink-secondary">{{ c.content }}</p>
            <button class="mt-1 text-label-sm text-ink-muted hover:text-pine-deep" @click="startReply(c.id)">
              回复
            </button>
            <div v-if="viewComment === c.id" class="mt-sm flex items-center gap-sm">
              <BaseInput v-model="commentText" :placeholder="`回复 ${c.author.nickname}`" />
              <BaseButton :disabled="commenting || !commentText.trim()" @click="submitComment">发送</BaseButton>
            </div>
          </div>
        </div>

        <BaseEmpty v-else title="暂无评论" description="来发表第一条评论吧" />
      </section>
    </main>

    <ReportDialog
      v-if="review"
      :open="reportOpen"
      target-type="review"
      :target-id="review.id"
      :target-label="`书评《${review.title}》`"
      @close="reportOpen = false"
    />

    <ShareDialog
      v-if="review"
      :open="shareOpen"
      type="review"
      :target-id="review.id"
      title="分享书评"
      @close="shareOpen = false"
    />
  </div>
</template>