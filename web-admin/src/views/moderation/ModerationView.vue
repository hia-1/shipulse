<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getModerationReviews,
  getModerationPosts,
  getModerationBooklists,
  auditReview,
  auditPost,
  auditBooklist,
  type AuditItem,
} from '@/api/adminManage'

type Tab = 'reviews' | 'posts' | 'booklists'
const active = ref<Tab>('reviews')
const loading = ref(false)
const list = ref<AuditItem[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, status: '' })

const tabs: { key: Tab; label: string }[] = [
  { key: 'reviews', label: '书评审核' },
  { key: 'posts', label: '动态审核' },
  { key: 'booklists', label: '书单审核' },
]

const fetchers: Record<Tab, (p: typeof query) => Promise<{ data: { items: AuditItem[]; total: number } }>> = {
  reviews: (p) => getModerationReviews(p),
  posts: (p) => getModerationPosts(p),
  booklists: (p) => getModerationBooklists(p),
}
const auditFns: Record<Tab, (id: string, a: string, r?: string) => Promise<unknown>> = {
  reviews: auditReview,
  posts: auditPost,
  booklists: auditBooklist,
}

async function load() {
  loading.value = true
  try {
    const res = await fetchers[active.value]({ ...query })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function switchTab() {
  query.page = 1
  load()
}

async function doAudit(row: AuditItem, action: 'approve' | 'reject') {
  const word = action === 'approve' ? '通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确定${word}该条${tabs.find((t) => t.key === active.value)?.label}吗？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  await auditFns[active.value](row.id, action, '')
  ElMessage.success(`已${word}`)
  load()
}

onMounted(load)

const statusText: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' }
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <el-radio-group v-model="active" @change="switchTab">
          <el-radio-button v-for="t in tabs" :key="t.key" :value="t.key">{{ t.label }}</el-radio-button>
        </el-radio-group>
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 130px" @change="switchTab">
          <el-option label="待审核" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="内容" min-width="280">
        <template #default="{ row }">
          <div class="content-cell">
            <div class="content-title">{{ row.title || (row.type === 'checkin' ? '阅读打卡' : '图文动态') }}</div>
            <div class="content-text">{{ row.content || (row.description || '') }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="用户ID" prop="userId" width="90" />
      <el-table-column v-if="active === 'reviews'" label="评分" width="80">
        <template #default="{ row }">{{ row.rating ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="互动" width="90">
        <template #default="{ row }">{{ (row.likeCount ?? row.collectCount ?? 0) }} 赞</template>
      </el-table-column>
      <el-table-column label="机审分" width="80">
        <template #default="{ row }">{{ row.machineScore ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="发布时间" width="160" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.auditStatus === 'approved' ? 'success' : row.auditStatus === 'rejected' ? 'danger' : 'warning'" size="small">
            {{ statusText[row.auditStatus] || row.auditStatus }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="160">
        <template #default="{ row }">
          <el-button link type="success" :disabled="row.auditStatus === 'approved'" @click="doAudit(row, 'approve')">通过</el-button>
          <el-button link type="danger" :disabled="row.auditStatus === 'rejected'" @click="doAudit(row, 'reject')">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="query.page"
        v-model:page-size="query.size"
        :total="total"
        layout="total, prev, pager, next, sizes"
        :page-sizes="[10, 20, 50]"
        @change="load"
      />
    </div>
  </el-card>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.content-cell { display: flex; flex-direction: column; line-height: 1.4; }
.content-title { font-weight: 500; }
.content-text { font-size: 12px; color: #84968d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>