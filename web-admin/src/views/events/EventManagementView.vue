<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getEvents,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  type AdminEvent,
} from '@/api/adminManage'

const loading = ref(false)
const list = ref<AdminEvent[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, status: '', type: '', keyword: '' })

const statusText: Record<string, string> = {
  draft: '草稿',
  ongoing: '报名/进行中',
  finished: '已结束',
  canceled: '已取消',
}
const statusTag: Record<string, string> = {
  draft: 'info',
  ongoing: 'success',
  finished: '',
  canceled: 'danger',
}
const typeText: Record<string, string> = { reading_camp: '共读营', activity: '活动' }

const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  title: '',
  type: 'activity',
  coverUrl: '',
  description: '',
  startTime: '',
  endTime: '',
  signupStart: '',
  signupEnd: '',
  capacity: 0,
  memberOnly: false,
})

async function load() {
  loading.value = true
  try {
    const res = await getEvents({ ...query })
    list.value = res.data.items
    total.value = res.data.total
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, {
    title: '',
    type: 'activity',
    coverUrl: '',
    description: '',
    startTime: '',
    endTime: '',
    signupStart: '',
    signupEnd: '',
    capacity: 0,
    memberOnly: false,
  })
}

function openCreate() {
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: AdminEvent) {
  editingId.value = row.id
  Object.assign(form, {
    title: row.title,
    type: row.type,
    coverUrl: row.coverUrl,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    signupStart: row.signupStart ?? '',
    signupEnd: row.signupEnd ?? '',
    capacity: row.capacity,
    memberOnly: row.memberOnly,
  })
  dialogVisible.value = true
}

async function submit() {
  if (!form.title.trim()) {
    ElMessage.warning('请填写活动标题')
    return
  }
  if (!form.startTime || !form.endTime) {
    ElMessage.warning('请选择活动开始与结束时间')
    return
  }
  if (new Date(form.endTime) <= new Date(form.startTime)) {
    ElMessage.warning('结束时间必须晚于开始时间')
    return
  }
  const payload = {
    ...form,
    signupStart: form.signupStart || undefined,
    signupEnd: form.signupEnd || undefined,
  }
  if (editingId.value) {
    await updateEvent(editingId.value, payload)
    ElMessage.success('活动已更新')
  } else {
    await createEvent(payload)
    ElMessage.success('活动已创建')
  }
  dialogVisible.value = false
  load()
}

async function changeStatus(row: AdminEvent, status: string) {
  const label = statusText[status]
  try {
    await ElMessageBox.confirm(`确定将活动「${row.title}」变更为「${label}」吗？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  await updateEventStatus(row.id, status)
  ElMessage.success('状态已更新')
  load()
}

async function remove(row: AdminEvent) {
  try {
    await ElMessageBox.confirm(`确定删除活动「${row.title}」吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await deleteEvent(row.id)
  ElMessage.success('已删除')
  load()
}

onMounted(load)
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <div class="filters">
          <el-input v-model="query.keyword" placeholder="活动标题" clearable style="width: 180px" @change="load" />
          <el-select v-model="query.type" placeholder="类型" clearable style="width: 130px" @change="load">
            <el-option label="共读营" value="reading_camp" />
            <el-option label="活动" value="activity" />
          </el-select>
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 140px" @change="load">
            <el-option label="草稿" value="draft" />
            <el-option label="报名/进行中" value="ongoing" />
            <el-option label="已结束" value="finished" />
            <el-option label="已取消" value="canceled" />
          </el-select>
        </div>
        <el-button type="primary" @click="openCreate">新建活动</el-button>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="活动" min-width="220">
        <template #default="{ row }">
          <div class="cell-title">{{ row.title }}</div>
          <div class="cell-sub">{{ typeText[row.type] || row.type }}
            <el-tag v-if="row.memberOnly" size="small" type="warning" effect="plain">会员专属</el-tag>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="时间" width="220">
        <template #default="{ row }">
          <div>{{ row.startTime }}</div>
          <div class="cell-sub">至 {{ row.endTime }}</div>
        </template>
      </el-table-column>
      <el-table-column label="报名" width="120">
        <template #default="{ row }">
          {{ row.signupCount }} / {{ row.capacity === 0 ? '不限' : row.capacity }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTag[row.status] as any" size="small">{{ statusText[row.status] || row.status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" fixed="right" width="280">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.status === 'draft'" link type="success" @click="changeStatus(row, 'ongoing')">发布</el-button>
          <el-button v-if="row.status === 'ongoing'" link type="warning" @click="changeStatus(row, 'finished')">结束</el-button>
          <el-button
            v-if="row.status === 'draft' || row.status === 'ongoing'"
            link
            type="info"
            @click="changeStatus(row, 'canceled')"
          >取消</el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑活动' : '新建活动'" width="620px">
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="128" placeholder="活动标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-radio-group v-model="form.type">
            <el-radio-button value="activity">活动</el-radio-button>
            <el-radio-button value="reading_camp">共读营</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="封面 URL">
          <el-input v-model="form.coverUrl" placeholder="https://..." />
        </el-form-item>
        <el-form-item label="活动时间" required>
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            placeholder="开始时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 48%"
          />
          <span class="sep">至</span>
          <el-date-picker
            v-model="form.endTime"
            type="datetime"
            placeholder="结束时间"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 44%"
          />
        </el-form-item>
        <el-form-item label="报名时间">
          <el-date-picker
            v-model="form.signupStart"
            type="datetime"
            placeholder="报名开始（可空）"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 48%"
          />
          <span class="sep">至</span>
          <el-date-picker
            v-model="form.signupEnd"
            type="datetime"
            placeholder="报名截止（可空）"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 44%"
          />
        </el-form-item>
        <el-form-item label="名额">
          <el-input-number v-model="form.capacity" :min="0" :max="100000" />
          <span class="hint">0 表示不限</span>
        </el-form-item>
        <el-form-item label="会员专属">
          <el-switch v-model="form.memberOnly" />
        </el-form-item>
        <el-form-item label="活动详情">
          <el-input v-model="form.description" type="textarea" :rows="4" maxlength="2000" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.filters { display: flex; gap: 10px; }
.cell-title { font-weight: 500; }
.cell-sub { font-size: 12px; color: #84968d; display: flex; align-items: center; gap: 6px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.sep { margin: 0 6px; color: #84968d; }
.hint { margin-left: 10px; color: #99a59f; font-size: 12px; }
</style>
