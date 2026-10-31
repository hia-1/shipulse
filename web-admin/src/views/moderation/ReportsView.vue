<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getReports,
  handleReport,
  getAppeals,
  reviewAppeal,
  type ReportItem,
  type AppealItem,
} from '@/api/adminManage'

type Tab = 'reports' | 'appeals'
const active = ref<Tab>('reports')
const loading = ref(false)
const reports = ref<ReportItem[]>([])
const appeals = ref<AppealItem[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, status: '' })

const targetText: Record<string, string> = {
  review: '书评',
  post: '动态',
  comment: '评论',
  booklist: '书单',
  user: '用户',
}
const reasonText: Record<string, string> = {
  porn: '色情低俗',
  abuse: '辱骂攻击',
  ad: '广告营销',
  spam: '垃圾信息',
  infringe: '侵权',
  other: '其他',
}
const reportStatusText: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已处理',
  rejected: '已驳回',
}
const appealStatusText: Record<string, string> = {
  pending: '待复核',
  approved: '已通过',
  rejected: '已驳回',
}

async function load() {
  loading.value = true
  try {
    if (active.value === 'reports') {
      const res = await getReports({ ...query })
      reports.value = res.data.items
      total.value = res.data.total
    } else {
      const res = await getAppeals({ ...query })
      appeals.value = res.data.items
      total.value = res.data.total
    }
  } finally {
    loading.value = false
  }
}

function switchTab() {
  query.page = 1
  query.status = ''
  load()
}

async function resolveReport(row: ReportItem) {
  try {
    const { value } = await ElMessageBox.prompt(
      '请输入处理结论（可留空，按累犯自动分级：首次删除告知 → 再次禁言7天 → 多次封号）',
      '处理举报',
      { inputType: 'textarea', inputPlaceholder: '处理结论', confirmButtonText: '受理并处罚', cancelButtonText: '取消' },
    )
    const res = await handleReport(row.id, { action: 'resolve', punishLevel: 'auto', result: value || '' })
    ElMessage.success(`已处理：${(res.data as { punishText?: string }).punishText ?? '已受理'}`)
    load()
  } catch {
    // 取消或失败
  }
}

async function rejectReport(row: ReportItem) {
  try {
    await ElMessageBox.confirm('确定驳回该举报吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await handleReport(row.id, { action: 'reject', result: '举报不成立' })
  ElMessage.success('已驳回')
  load()
}

async function approveAppeal(row: AppealItem) {
  try {
    await ElMessageBox.confirm('确定通过该申诉并撤销原处罚吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await reviewAppeal(row.id, { action: 'approve', result: '申诉通过，撤销处罚' })
  ElMessage.success('已改判')
  load()
}

async function rejectAppeal(row: AppealItem) {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回理由', '驳回申诉', {
      inputType: 'textarea',
      confirmButtonText: '驳回',
      cancelButtonText: '取消',
    })
    await reviewAppeal(row.id, { action: 'reject', result: value || '维持原处罚' })
    ElMessage.success('已驳回申诉')
    load()
  } catch {
    // 取消或失败
  }
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <el-radio-group v-model="active" @change="switchTab">
          <el-radio-button value="reports">举报处理</el-radio-button>
          <el-radio-button value="appeals">申诉复核</el-radio-button>
        </el-radio-group>
        <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="switchTab">
          <template v-if="active === 'reports'">
            <el-option label="待处理" value="pending" />
            <el-option label="已处理" value="resolved" />
            <el-option label="已驳回" value="rejected" />
          </template>
          <template v-else>
            <el-option label="待复核" value="pending" />
            <el-option label="已通过" value="approved" />
            <el-option label="已驳回" value="rejected" />
          </template>
        </el-select>
      </div>
    </template>

    <!-- 举报处理 -->
    <el-table v-if="active === 'reports'" :data="reports" v-loading="loading" stripe>
      <el-table-column label="对象" width="110">
        <template #default="{ row }">
          {{ targetText[row.targetType] || row.targetType }} #{{ row.targetId }}
        </template>
      </el-table-column>
      <el-table-column label="理由" width="110">
        <template #default="{ row }">{{ reasonText[row.reason] || row.reason }}</template>
      </el-table-column>
      <el-table-column label="举报说明" prop="description" min-width="180" show-overflow-tooltip />
      <el-table-column label="举报人" prop="reporterId" width="90" />
      <el-table-column prop="createdAt" label="举报时间" width="170" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'resolved' ? 'success' : row.status === 'rejected' ? 'info' : 'warning'" size="small">
            {{ reportStatusText[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理结果" prop="handleResult" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" fixed="right" width="160">
        <template #default="{ row }">
          <el-button link type="primary" :disabled="row.status !== 'pending'" @click="resolveReport(row)">受理处罚</el-button>
          <el-button link type="danger" :disabled="row.status !== 'pending'" @click="rejectReport(row)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 申诉复核 -->
    <el-table v-else :data="appeals" v-loading="loading" stripe>
      <el-table-column label="对象" width="110">
        <template #default="{ row }">
          {{ targetText[row.targetType] || row.targetType }} #{{ row.targetId }}
        </template>
      </el-table-column>
      <el-table-column label="申诉人" prop="userId" width="90" />
      <el-table-column label="申诉理由" prop="reason" min-width="200" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="提交时间" width="170" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'info' : 'warning'" size="small">
            {{ appealStatusText[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="复核结论" prop="reviewResult" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" fixed="right" width="160">
        <template #default="{ row }">
          <el-button link type="success" :disabled="row.status !== 'pending'" @click="approveAppeal(row)">通过改判</el-button>
          <el-button link type="danger" :disabled="row.status !== 'pending'" @click="rejectAppeal(row)">驳回</el-button>
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
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
