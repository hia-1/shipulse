<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getBooks, updateBookStatus, type AdminBookItem } from '@/api/adminManage'

const loading = ref(false)
const list = ref<AdminBookItem[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function load() {
  loading.value = true
  try {
    const res = await getBooks({ ...query })
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

async function changeStatus(row: AdminBookItem, status: string) {
  const label = status === 'on_shelf' ? '上架' : status === 'off_shelf' ? '下架' : '退回待审'
  try {
    await ElMessageBox.confirm(`确定${label}书籍《${row.title}》吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await updateBookStatus(row.id, status)
  ElMessage.success(`已${label}`)
  load()
}

onMounted(load)

const statusText: Record<string, string> = { on_shelf: '已上架', off_shelf: '已下架', pending: '待审核' }
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <span class="card-title">书库管理</span>
        <div class="filters">
          <el-select v-model="query.status" placeholder="状态" clearable style="width: 130px" @change="search">
            <el-option label="已上架" value="on_shelf" />
            <el-option label="已下架" value="off_shelf" />
            <el-option label="待审核" value="pending" />
          </el-select>
          <el-input
            v-model="query.keyword"
            placeholder="书名 / 作者 / ISBN"
            clearable
            style="width: 220px"
            @keyup.enter="search"
            @clear="search"
          >
            <template #append><el-button @click="search">搜索</el-button></template>
          </el-input>
        </div>
      </div>
    </template>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="书籍" min-width="240">
        <template #default="{ row }">
          <div class="book-cell">
            <el-image :src="row.coverUrl" :preview-src-list="[row.coverUrl]" fit="cover" class="cover" />
            <div class="book-meta">
              <span class="book-title">{{ row.title }}</span>
              <span class="book-author">{{ row.author || '佚名' }}{{ row.isbn ? ' · ' + row.isbn : '' }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="publisher" label="出版社" width="140">
        <template #default="{ row }">{{ row.publisher || '—' }}</template>
      </el-table-column>
      <el-table-column label="评分" width="90">
        <template #default="{ row }">
          <span v-if="Number(row.ratingCount) > 0">{{ row.ratingAvg }}（{{ row.ratingCount }}）</span>
          <span v-else class="muted">暂无</span>
        </template>
      </el-table-column>
      <el-table-column prop="shelfCount" label="收藏/书架" width="100" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'on_shelf' ? 'success' : row.status === 'pending' ? 'warning' : 'info'" size="small">
            {{ statusText[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="入库时间" width="160" />
      <el-table-column label="操作" fixed="right" width="170">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'on_shelf'" link type="success" @click="changeStatus(row, 'on_shelf')">上架</el-button>
          <el-button v-if="row.status === 'on_shelf'" link type="danger" @click="changeStatus(row, 'off_shelf')">下架</el-button>
          <el-button link type="warning" @click="changeStatus(row, 'pending')">退回待审</el-button>
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
.book-cell { display: flex; align-items: center; gap: 12px; }
.cover { width: 40px; height: 54px; border-radius: 4px; flex-shrink: 0; background: #eef1ee; }
.book-meta { display: flex; flex-direction: column; line-height: 1.35; }
.book-title { font-weight: 500; }
.book-author { font-size: 12px; color: #99a59f; }
.muted { color: #99a59f; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>