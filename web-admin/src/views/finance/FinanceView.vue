<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getOrderSummary,
  getOrders,
  getRedeemCodes,
  generateRedeem,
  type OrderSummary,
  type OrderItem,
  type RedeemItem,
} from '@/api/adminManage'

const summary = ref<OrderSummary | null>(null)
const loading = ref(false)

const yuan = (fen: number) => (fen / 100).toFixed(2)

async function loadSummary() {
  try {
    const res = await getOrderSummary()
    summary.value = res.data
  } catch {
    // 概览失败不阻塞订单/兑换码加载，错误提示由 http 拦截器统一弹出
    summary.value = null
  }
}

/* ---------- 订单 ---------- */
const orders = ref<OrderItem[]>([])
const orderTotal = ref(0)
const orderQuery = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function loadOrders() {
  loading.value = true
  try {
    const res = await getOrders({ ...orderQuery })
    orders.value = res.data.items
    orderTotal.value = res.data.total
  } finally {
    loading.value = false
  }
}

function searchOrders() {
  orderQuery.page = 1
  loadOrders()
}

/* ---------- 兑换码 ---------- */
const activeTab = ref('order')
const codes = ref<RedeemItem[]>([])
const codeTotal = ref(0)
const codeQuery = reactive({ page: 1, size: 10, status: '' })

async function loadCodes() {
  loading.value = true
  try {
    const res = await getRedeemCodes({ ...codeQuery })
    codes.value = res.data.items
    codeTotal.value = res.data.total
  } finally {
    loading.value = false
  }
}

const genDialog = ref(false)
const genForm = reactive({ planId: '', durationDays: 30, count: 10, batchNo: '' })

async function doGenerate() {
  const planId = (genForm.planId || '').trim()
  if (!planId) {
    ElMessage.warning('请填写会员套餐 ID')
    return
  }
  if (!Number.isInteger(genForm.durationDays) || genForm.durationDays < 1) {
    ElMessage.warning('会员时长需为不小于 1 的整数')
    return
  }
  if (!Number.isInteger(genForm.count) || genForm.count < 1 || genForm.count > 500) {
    ElMessage.warning('生成数量需为 1-500 的整数')
    return
  }
  try {
    await ElMessageBox.confirm(`确定生成 ${genForm.count} 个兑换码吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  const res = await generateRedeem({ ...genForm, planId })
  ElMessage.success(`已生成 ${res.data.count} 个兑换码（批次 ${res.data.batchNo}）`)
  genDialog.value = false
  Object.assign(genForm, { planId: '', durationDays: 30, count: 10, batchNo: '' })
  loadCodes()
}

function switchTab() {
  if (activeTab.value === 'order') loadOrders()
  else loadCodes()
}

const orderStatusText: Record<string, { text: string; type: string }> = {
  paid: { text: '已支付', type: 'success' },
  pending: { text: '待支付', type: 'warning' },
  refunded: { text: '已退款', type: 'info' },
  closed: { text: '已关闭', type: 'info' },
}
const codeStatusText: Record<string, { text: string; type: string }> = {
  unused: { text: '未使用', type: 'success' },
  used: { text: '已使用', type: 'info' },
  disabled: { text: '已停用', type: 'danger' },
}

onMounted(() => {
  void loadSummary()
  void loadOrders()
})
</script>

<template>
  <!-- 财务概览 -->
  <el-row :gutter="14" class="summary-row">
    <el-col :span="6">
      <el-card shadow="never" class="sum-card">
        <div class="sum-label">今日营收</div>
        <div class="sum-value money">¥{{ summary ? yuan(summary.revenueTodayFen) : '—' }}</div>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="never" class="sum-card">
        <div class="sum-label">累计营收</div>
        <div class="sum-value money">¥{{ summary ? yuan(summary.revenueFen) : '—' }}</div>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="never" class="sum-card">
        <div class="sum-label">今日支付订单</div>
        <div class="sum-value">{{ summary ? summary.todayPaidCount : '—' }}<span class="unit"> 单</span></div>
      </el-card>
    </el-col>
    <el-col :span="6">
      <el-card shadow="never" class="sum-card">
        <div class="sum-label">订单状态</div>
        <div class="sum-value">{{ summary ? `${summary.paidCount} 已支付 / ${summary.refundedCount} 退款` : '—' }}</div>
      </el-card>
    </el-col>
  </el-row>

  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <span class="card-title">会员订单与兑换码</span>
        <el-radio-group v-model="activeTab" @change="switchTab">
          <el-radio-button value="order">订单</el-radio-button>
          <el-radio-button value="redeem">兑换码</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <!-- 订单 -->
    <div v-if="activeTab === 'order'">
      <div class="op-bar">
        <div class="filter-row">
          <el-input
            v-model="orderQuery.keyword"
            placeholder="订单号 / 用户 ID"
            clearable
            style="width: 220px"
            @keyup.enter="searchOrders"
          />
          <el-select
            v-model="orderQuery.status"
            placeholder="全部状态"
            clearable
            style="width: 140px"
            @change="searchOrders"
          >
            <el-option label="全部" value="" />
            <el-option label="已支付" value="paid" />
            <el-option label="待支付" value="pending" />
            <el-option label="已退款" value="refunded" />
            <el-option label="已关闭" value="closed" />
          </el-select>
          <el-button type="primary" @click="searchOrders">查询</el-button>
        </div>
      </div>
      <el-table :data="orders" v-loading="loading" stripe>
        <el-table-column prop="orderNo" label="订单号" width="180" />
        <el-table-column label="商品" min-width="180">
          <template #default="{ row }">{{ row.title }}</template>
        </el-table-column>
        <el-table-column label="用户" width="80">
          <template #default="{ row }">#{{ row.userId }}</template>
        </el-table-column>
        <el-table-column label="金额" width="110">
          <template #default="{ row }">¥{{ yuan(row.amountFen) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="(orderStatusText[row.status]?.type as any) || 'info'" size="small">
              {{ orderStatusText[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="channel" label="渠道" width="80" />
        <el-table-column prop="paidAt" label="支付时间" width="160">
          <template #default="{ row }">{{ row.paidAt || '—' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="orderQuery.page"
          v-model:page-size="orderQuery.size"
          :total="orderTotal"
          layout="total, prev, pager, next"
          :page-sizes="[10]"
          @change="loadOrders"
        />
      </div>
    </div>

    <!-- 兑换码 -->
    <div v-else>
      <div class="op-bar">
        <el-radio-group v-model="codeQuery.status" size="small" @change="loadCodes">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="unused">未使用</el-radio-button>
          <el-radio-button value="used">已使用</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="genDialog = true">批量生成</el-button>
      </div>
      <el-table :data="codes" v-loading="loading" stripe>
        <el-table-column prop="code" label="兑换码" width="200" />
        <el-table-column prop="batchNo" label="批次" width="140" />
        <el-table-column label="时长" width="100">
          <template #default="{ row }">{{ row.durationDays }} 天</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="(codeStatusText[row.status]?.type as any) || 'info'" size="small">
              {{ codeStatusText[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="使用人" width="100">
          <template #default="{ row }">{{ row.usedBy ? `#${row.usedBy}` : '—' }}</template>
        </el-table-column>
        <el-table-column prop="usedAt" label="使用时间" width="160">
          <template #default="{ row }">{{ row.usedAt || '—' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="160" />
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="codeQuery.page"
          v-model:page-size="codeQuery.size"
          :total="codeTotal"
          layout="total, prev, pager, next"
          :page-sizes="[10]"
          @change="loadCodes"
        />
      </div>
    </div>

    <!-- 生成兑换码弹窗 -->
    <el-dialog v-model="genDialog" title="批量生成兑换码" width="480">
      <el-form :model="genForm" label-width="90px">
        <el-form-item label="套餐 ID"><el-input v-model="genForm.planId" placeholder="会员套餐 ID" /></el-form-item>
        <el-form-item label="会员时长">
          <el-input-number v-model="genForm.durationDays" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="生成数量">
          <el-input-number v-model="genForm.count" :min="1" :max="200" />
        </el-form-item>
        <el-form-item label="批次号"><el-input v-model="genForm.batchNo" placeholder="留空自动生成" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genDialog = false">取消</el-button>
        <el-button type="primary" @click="doGenerate">生成</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.card-title { font-size: 16px; font-weight: 600; color: #2d4a43; }
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.op-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.filter-row { display: flex; align-items: center; gap: 10px; }
.summary-row { margin-bottom: 16px; }
.sum-card :deep(.el-card__body) { padding: 16px; }
.sum-label { font-size: 13px; color: #99a59f; margin-bottom: 8px; }
.sum-value { font-size: 26px; font-weight: 700; color: #2d4a43; }
.sum-value.money { color: #c9514b; }
.unit { font-size: 14px; font-weight: 500; color: #99a59f; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>