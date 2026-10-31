<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getUsers,
  updateUserStatus,
  toggleUserMember,
  type AdminUserItem,
} from '@/api/adminManage'

const loading = ref(false)
const list = ref<AdminUserItem[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function load() {
  loading.value = true
  try {
    const res = await getUsers({ ...query })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

async function toggleStatus(row: AdminUserItem) {
  const target = row.status === 'banned' || row.status === 'canceled' ? 'active' : 'banned'
  try {
    await ElMessageBox.confirm(
      `确定将用户「${row.nickname}」${target === 'banned' ? '禁用' : '启用'}吗？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await updateUserStatus(row.id, target)
  ElMessage.success('已更新')
  load()
}

async function toggleMute(row: AdminUserItem) {
  const target = row.status === 'muted' ? 'active' : 'muted'
  try {
    await ElMessageBox.confirm(
      `确定${target === 'muted' ? '禁言' : '解除禁言'}用户「${row.nickname}」吗？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await updateUserStatus(row.id, target)
  ElMessage.success('已更新')
  load()
}

async function toggleMember(row: AdminUserItem) {
  const target = row.isMember ? 0 : 1
  try {
    await ElMessageBox.confirm(
      `确定${target ? '开通（30 天）' : '取消'}用户「${row.nickname}」的会员身份吗？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  await toggleUserMember(row.id, target)
  ElMessage.success('已更新')
  load()
}

onMounted(load)

const statusText: Record<string, string> = {
  active: '正常',
  muted: '已禁言',
  banned: '已禁用',
  canceled: '已注销',
}

const statusTagType: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
  active: 'success',
  muted: 'warning',
  banned: 'danger',
  canceled: 'info',
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <span class="card-title">用户管理</span>
        <div class="filters">
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 120px" @change="search">
            <el-option label="正常" value="active" />
            <el-option label="已禁言" value="muted" />
            <el-option label="已禁用" value="banned" />
            <el-option label="已注销" value="canceled" />
          </el-select>
          <el-input
            v-model="query.keyword"
            placeholder="昵称 / 手机号 / ID"
            clearable
            style="width: 220px"
            @keyup.enter="search"
            @clear="search"
          >
            <template #append>
              <el-button @click="search">搜索</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="用户" min-width="200">
        <template #default="{ row }">
          <div class="user-cell">
            <el-avatar :size="32" :src="row.avatarUrl || undefined">{{ row.nickname?.charAt(0) }}</el-avatar>
            <div class="user-meta">
              <span class="user-nick">{{ row.nickname || '未命名' }}</span>
              <span class="user-sub">ID {{ row.id }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="手机号" width="130">
        <template #default="{ row }">{{ row.phone || '—' }}</template>
      </el-table-column>
      <el-table-column label="会员" width="100">
        <template #default="{ row }">
          <el-tag :type="row.isMember ? 'success' : 'info'" size="small">{{ row.isMember ? '会员' : '普通' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusTagType[row.status] || 'info'" size="small">
            {{ statusText[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="数据" width="150">
        <template #default="{ row }">书架 {{ row.bookCount }} · 书评 {{ row.reviewCount }}</template>
      </el-table-column>
      <el-table-column prop="createdAt" label="注册时间" width="160" />
      <el-table-column prop="lastLoginAt" label="最近登录" width="160">
        <template #default="{ row }">{{ row.lastLoginAt || '—' }}</template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="250">
        <template #default="{ row }">
          <el-button link type="primary" @click="toggleMember(row)">{{ row.isMember ? '取消会员' : '开会员' }}</el-button>
          <el-button
            v-if="row.status === 'active' || row.status === 'muted'"
            link
            type="warning"
            @click="toggleMute(row)"
          >
            {{ row.status === 'muted' ? '解除禁言' : '禁言' }}
          </el-button>
          <el-button link :type="row.status === 'banned' || row.status === 'canceled' ? 'success' : 'danger'" @click="toggleStatus(row)">
            {{ row.status === 'banned' || row.status === 'canceled' ? '启用' : '禁用' }}
          </el-button>
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
.card-title { font-size: 16px; font-weight: 600; color: #2d4a43; }
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.filters { display: flex; gap: 10px; }
.user-cell { display: flex; align-items: center; gap: 10px; }
.user-meta { display: flex; flex-direction: column; line-height: 1.3; }
.user-nick { font-weight: 500; }
.user-sub { font-size: 12px; color: #99a59f; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>