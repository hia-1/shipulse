<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { confirmDialog } from '@/composables/useConfirm'
import { showToast } from '@/composables/useToast'
import { BaseButton, BaseModal, BaseInput, BaseTextarea, BaseEmpty } from '@/components/base'
import ReportDialog from '@/components/report/ReportDialog.vue'
import ShareDialog from '@/components/share/ShareDialog.vue'
import {
  booklistDetail,
  updateBooklist,
  deleteBooklist,
  addBookToBooklist,
  removeBookFromBooklist,
  collectBooklist,
  uncollectBooklist,
  type BooklistDetail,
} from '@/api/booklist'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const id = Number(route.params.id)
const detail = ref<BooklistDetail | null>(null)
const loading = ref(true)
const loadError = ref('')

const editOpen = ref(false)
const editForm = ref({ title: '', description: '', coverUrl: '' })
const editError = ref('')
const saving = ref(false)

const addOpen = ref(false)
const addForm = ref({ bookId: '', note: '' })
const addError = ref('')
const adding = ref(false)

const reportOpen = ref(false)
const shareOpen = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await booklistDetail(id)
    detail.value = res.data
  } catch (e) {
    detail.value = null
    loadError.value = (e as Error).message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function openEdit() {
  if (!detail.value) return
  editForm.value = {
    title: detail.value.title,
    description: detail.value.description,
    coverUrl: detail.value.coverUrl,
  }
  editError.value = ''
  editOpen.value = true
}

async function submitEdit() {
  if (!editForm.value.title.trim()) {
    editError.value = '标题不能为空'
    return
  }
  saving.value = true
  editError.value = ''
  try {
    const res = await updateBooklist(detail.value!.id, {
      title: editForm.value.title.trim(),
      description: editForm.value.description.trim(),
      coverUrl: editForm.value.coverUrl.trim(),
    })
    detail.value = res.data
    editOpen.value = false
  } catch (e) {
    editError.value = (e as Error).message || '保存失败'
  } finally {
    saving.value = false
  }
}

async function submitDelete() {
  if (!(await confirmDialog({ message: '确定删除这份书单吗？', danger: true, confirmText: '删除' }))) return
  try {
    await deleteBooklist(id)
    router.push('/booklists/square')
  } catch (e) {
    showToast((e as Error).message || '删除失败', 'error')
  }
}

async function submitAdd() {
  const bookId = Number(addForm.value.bookId)
  if (!bookId) {
    addError.value = '请输入有效的图书 ID'
    return
  }
  adding.value = true
  addError.value = ''
  try {
    const res = await addBookToBooklist(id, {
      bookId,
      note: addForm.value.note.trim(),
    })
    detail.value = res.data
    addOpen.value = false
  } catch (e) {
    addError.value = (e as Error).message || '添加失败'
  } finally {
    adding.value = false
  }
}

async function handleRemove(bookId: number) {
  if (!(await confirmDialog({ message: '从书单中移除这本书？', danger: true, confirmText: '移除' }))) return
  try {
    const res = await removeBookFromBooklist(id, bookId)
    detail.value = res.data
  } catch (e) {
    showToast((e as Error).message || '移除失败', 'error')
  }
}

async function toggleCollect() {
  if (!detail.value) return
  if (!userStore.isLoggedIn) {
    router.push('/login')
    return
  }
  try {
    if (detail.value.collected) {
      const res = await uncollectBooklist(id)
      detail.value.collected = false
      detail.value.collectCount = res.data.collectCount
    } else {
      const res = await collectBooklist(id)
      detail.value.collected = res.data.collected
      detail.value.collectCount = res.data.collectCount
    }
  } catch (e) {
    showToast((e as Error).message || '操作失败', 'error')
  }
}

onMounted(load)
</script>

<template>
  <main class="min-h-screen bg-paper-warm py-xl">
    <div class="max-w-container mx-auto px-md">
      <div class="max-w-md mx-auto space-y-lg">
        <div v-if="loading" class="py-xl text-center text-body-md text-ink-muted">加载中…</div>

        <template v-else-if="detail">
          <!-- 书单头图 -->
          <div class="rounded-lg border border-hairline bg-paper-elevated p-lg shadow-level-1">
            <div class="flex items-start gap-md">
              <div
                class="flex h-28 w-20 shrink-0 items-center justify-center rounded border border-hairline bg-pine-subtle font-serif text-pine-deep"
                :style="detail.coverUrl ? { backgroundImage: `url(${detail.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
              >
                <span v-if="!detail.coverUrl" class="text-headline-md">{{ detail.title.charAt(0) }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-xs">
                  <h1 class="text-title-md text-ink-primary font-serif">{{ detail.title }}</h1>
                  <span v-if="detail.isOfficial" class="shrink-0 rounded bg-gold-tint px-1.5 py-0.5 text-label-sm text-gold-patina">官方</span>
                </div>
                <p class="mt-1 text-label-md text-ink-muted">
                  由 {{ detail.creator }} 创建 · {{ detail.books.length }} 本书
                </p>
              </div>
            </div>
            <p v-if="detail.description" class="mt-md text-body-sm text-ink-secondary leading-relaxed">{{ detail.description }}</p>

            <div class="mt-md flex gap-sm">
              <BaseButton :variant="detail.collected ? 'primary' : 'ghost'" class="flex-1" @click="toggleCollect">
                {{ detail.collected ? '已收藏' : '收藏' }}（{{ detail.collectCount }}）
              </BaseButton>
              <BaseButton variant="ghost" @click="shareOpen = true">分享</BaseButton>
              <BaseButton v-if="detail.isMine" variant="ghost" @click="openEdit">编辑</BaseButton>
              <BaseButton v-if="detail.isMine" variant="ghost" class="text-danger" @click="submitDelete">删除</BaseButton>
              <BaseButton
                v-if="!detail.isMine && userStore.isLoggedIn"
                variant="ghost"
                class="text-ink-muted"
                @click="reportOpen = true"
              >
                举报
              </BaseButton>
            </div>
          </div>

          <!-- 审核状态提示（仅创建者可见） -->
          <div
            v-if="detail.isMine && detail.auditStatus && detail.auditStatus !== 'approved'"
            class="rounded border p-md text-body-sm"
            :class="detail.auditStatus === 'rejected' ? 'border-danger/30 bg-danger/5 text-danger' : 'border-gold-patina/40 bg-gold-tint text-gold-patina'"
          >
            <template v-if="detail.auditStatus === 'rejected'">
              该书单未通过审核{{ detail.auditReason ? `：${detail.auditReason}` : '' }}，不会出现在广场。
            </template>
            <template v-else>该书单正在审核中，通过后将出现在广场。</template>
          </div>

          <!-- 操作提示 -->
          <div v-if="detail.isMine" class="rounded border border-hairline bg-paper-elevated p-md text-body-sm text-ink-muted">
            你是创建者：可添加图书（输入图书 ID）或移除书目。
          </div>

          <!-- 书目列表 -->
          <div class="rounded-lg border border-hairline bg-paper-elevated shadow-level-1 overflow-hidden">
            <div class="flex items-center justify-between px-lg pt-lg">
              <h2 class="text-title-lg text-ink-primary">书目</h2>
              <BaseButton v-if="detail.isMine" variant="ghost" @click="addOpen = true">+ 添加图书</BaseButton>
            </div>
            <BaseEmpty v-if="!detail.books.length" class="py-lg" title="书单还是空的" description="用「+ 添加图书」录入第一本书" />
            <ul v-else class="divide-y divide-hairline">
              <li v-for="(b, i) in detail.books" :key="b.bookId" class="px-lg py-md">
                <div class="flex items-start gap-sm">
                  <RouterLink :to="`/books/${b.bookId}`" class="flex min-w-0 flex-1 items-start gap-sm">
                    <div
                      class="flex h-20 w-14 shrink-0 items-center justify-center rounded border border-hairline bg-paper-warm text-ink-faint"
                      :style="b.coverUrl ? { backgroundImage: `url(${b.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
                    >
                      <span v-if="!b.coverUrl" class="text-label-md">{{ b.title.charAt(0) }}</span>
                    </div>
                    <div class="min-w-0">
                      <p class="text-body-md text-ink-primary font-medium truncate">{{ b.title }}</p>
                      <p class="text-body-sm text-ink-muted mt-0.5">{{ b.author }}</p>
                      <p v-if="b.note" class="mt-1 text-label-sm text-pine-deep">「{{ b.note }}」</p>
                    </div>
                  </RouterLink>
                  <span class="shrink-0 text-label-md text-ink-faint">#{{ i + 1 }}</span>
                  <button
                    v-if="detail.isMine"
                    type="button"
                    class="shrink-0 text-label-md text-danger"
                    @click="handleRemove(b.bookId)"
                  >
                    移除
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </template>

        <div v-else-if="loadError" class="py-xl text-center">
          <p class="text-body-md text-danger">{{ loadError }}</p>
          <BaseButton variant="ghost" class="mt-md" @click="load">重试</BaseButton>
        </div>
        <div v-else class="py-xl text-center text-body-md text-ink-muted">书单不存在或已下架</div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <BaseModal :open="editOpen" title="编辑书单" @close="editOpen = false">
      <form class="space-y-md" @submit.prevent="submitEdit">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">标题 *</label>
          <BaseInput v-model="editForm.title" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">简介</label>
          <BaseTextarea v-model="editForm.description" :rows="3" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">封面 URL</label>
          <BaseInput v-model="editForm.coverUrl" placeholder="https://…" />
        </div>
        <p v-if="editError" class="text-body-sm text-danger">{{ editError }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="editOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <!-- 添加图书弹窗 -->
    <BaseModal :open="addOpen" title="添加图书" @close="addOpen = false">
      <form class="space-y-md" @submit.prevent="submitAdd">
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">图书 ID *</label>
          <BaseInput v-model="addForm.bookId" placeholder="输入图书 ID（如 12）" inputmode="numeric" />
        </div>
        <div class="space-y-2xs">
          <label class="text-label-md text-ink-muted">推荐语（选填）</label>
          <BaseInput v-model="addForm.note" placeholder="为什么推荐这本书" />
        </div>
        <p v-if="addError" class="text-body-sm text-danger">{{ addError }}</p>
        <div class="flex gap-sm">
          <BaseButton variant="ghost" class="flex-1" type="button" @click="addOpen = false">取消</BaseButton>
          <BaseButton class="flex-1" type="submit" :disabled="adding">{{ adding ? '添加中…' : '添加' }}</BaseButton>
        </div>
      </form>
    </BaseModal>

    <ReportDialog
      v-if="detail"
      :open="reportOpen"
      target-type="booklist"
      :target-id="detail.id"
      :target-label="`书单《${detail.title}》`"
      @close="reportOpen = false"
    />

    <ShareDialog
      v-if="detail"
      :open="shareOpen"
      type="booklist"
      :target-id="detail.id"
      title="分享书单"
      @close="shareOpen = false"
    />
  </main>
</template>