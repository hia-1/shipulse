<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getColumns,
  createColumn,
  updateColumn,
  deleteColumn,
  getTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  type AdminBanner,
  type AdminColumn,
  type AdminTopic,
} from '@/api/adminManage'

const activeTab = ref('banner')

/** 与后端 IsHttpUrl 一致：仅接受 http/https 绝对地址 */
function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** 与后端 IsSafeLink 一致：数字 ID / 站内路径 / http(s) 绝对地址，拒绝协议相对 // */
function isSafeLink(value: string): boolean {
  const v = value.trim()
  if (/^\d+$/.test(v)) return true
  if (v.startsWith('//')) return false
  if (v.startsWith('/')) return true
  return isHttpUrl(v)
}

/* ---------- Banner ---------- */
const bannerLoading = ref(false)
const banners = ref<AdminBanner[]>([])
const bannerTotal = ref(0)
const bannerQuery = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function loadBanners() {
  bannerLoading.value = true
  try {
    const res = await getBanners({ ...bannerQuery })
    banners.value = res.data.items
    bannerTotal.value = res.data.total
  } finally {
    bannerLoading.value = false
  }
}

const bannerDialog = ref(false)
const bannerForm = ref<Partial<AdminBanner>>({ status: 'on', linkType: 'none', sort: 0 })

function openBanner(row?: AdminBanner) {
  bannerForm.value = row
    ? { ...row, linkType: row.linkType || 'none' }
    : { status: 'on', linkType: 'none', sort: 0, position: 'home_top' }
  bannerDialog.value = true
}

async function saveBanner() {
  const d = bannerForm.value
  const title = (d.title || '').trim()
  if (!title) {
    ElMessage.warning('请填写 Banner 标题')
    return
  }
  const imageUrl = (d.imageUrl || '').trim()
  if (!imageUrl) {
    ElMessage.warning('请填写图片 URL')
    return
  }
  if (!isHttpUrl(imageUrl)) {
    ElMessage.warning('图片 URL 必须是 http/https 开头的合法链接')
    return
  }
  const linkValue = (d.linkValue || '').trim()
  if (d.linkType && d.linkType !== 'none' && !linkValue) {
    ElMessage.warning('已选择跳转类型，请填写跳转值')
    return
  }
  if (linkValue && !isSafeLink(linkValue)) {
    ElMessage.warning('跳转值只能是站内路径、http/https 链接或数字 ID')
    return
  }
  const payload = { ...d, title, imageUrl, linkValue }
  if (d.id) {
    await updateBanner(d.id, payload)
  } else {
    await createBanner(payload)
  }
  bannerDialog.value = false
  ElMessage.success('已保存')
  loadBanners()
}

async function removeBanner(row: AdminBanner) {
  try {
    await ElMessageBox.confirm('确定删除该 Banner 吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await deleteBanner(row.id)
  ElMessage.success('已删除')
  loadBanners()
}

async function toggleBanner(row: AdminBanner) {
  const target = row.status === 'on' ? 'off' : 'on'
  const label = target === 'on' ? '启用' : '停用'
  try {
    await ElMessageBox.confirm(`确定${label} Banner「${row.title}」吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await updateBanner(row.id, { status: target })
  ElMessage.success('已更新')
  loadBanners()
}

/* ---------- 专栏 ---------- */
const columnLoading = ref(false)
const columns = ref<AdminColumn[]>([])
const columnTotal = ref(0)
const columnQuery = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function loadColumns() {
  columnLoading.value = true
  try {
    const res = await getColumns({ ...columnQuery })
    columns.value = res.data.items
    columnTotal.value = res.data.total
  } finally {
    columnLoading.value = false
  }
}

const columnDialog = ref(false)
const columnForm = ref<Partial<AdminColumn>>({ status: 'on', type: 'editorial', sort: 0 })

function openColumn(row?: AdminColumn) {
  columnForm.value = row
    ? { ...row }
    : { status: 'on', type: 'editorial', sort: 0 }
  columnDialog.value = true
}

async function saveColumn() {
  const d = columnForm.value
  if (!d.type) {
    ElMessage.warning('请选择专栏类型')
    return
  }
  const title = (d.title || '').trim()
  if (!title) {
    ElMessage.warning('请填写专栏标题')
    return
  }
  const coverUrl = (d.coverUrl || '').trim()
  if (coverUrl && !isHttpUrl(coverUrl)) {
    ElMessage.warning('封面 URL 必须是 http/https 开头的合法链接')
    return
  }
  const payload = { ...d, title, coverUrl }
  if (d.id) {
    await updateColumn(d.id, payload)
  } else {
    await createColumn(payload)
  }
  columnDialog.value = false
  ElMessage.success('已保存')
  loadColumns()
}

async function removeColumn(row: AdminColumn) {
  try {
    await ElMessageBox.confirm('确定删除该专栏吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await deleteColumn(row.id)
  ElMessage.success('已删除')
  loadColumns()
}

async function toggleColumn(row: AdminColumn) {
  const target = row.status === 'on' ? 'off' : 'on'
  const label = target === 'on' ? '发布' : '下架'
  try {
    await ElMessageBox.confirm(`确定${label}专栏「${row.title}」吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await updateColumn(row.id, { status: target })
  ElMessage.success(target === 'on' ? '已发布' : '已下架')
  loadColumns()
}

function switchTab() {
  if (activeTab.value === 'banner') loadBanners()
  else if (activeTab.value === 'topic') loadTopics()
  else loadColumns()
}

/* ---------- 话题 ---------- */
const topicLoading = ref(false)
const topics = ref<AdminTopic[]>([])
const topicTotal = ref(0)
const topicQuery = reactive({ page: 1, size: 10, keyword: '', status: '' })

async function loadTopics() {
  topicLoading.value = true
  try {
    const res = await getTopics({ ...topicQuery })
    topics.value = res.data.items
    topicTotal.value = res.data.total
  } finally {
    topicLoading.value = false
  }
}

const topicDialog = ref(false)
const topicForm = ref<Partial<AdminTopic>>({ status: 'on', sort: 0 })

function openTopic(row?: AdminTopic) {
  topicForm.value = row ? { ...row } : { status: 'on', sort: 0, description: '', coverUrl: '' }
  topicDialog.value = true
}

async function saveTopic() {
  const d = topicForm.value
  const title = (d.title || '').trim()
  if (!title) {
    ElMessage.warning('请填写话题名称')
    return
  }
  const coverUrl = (d.coverUrl || '').trim()
  if (coverUrl && !isHttpUrl(coverUrl)) {
    ElMessage.warning('封面 URL 必须是 http/https 开头的合法链接')
    return
  }
  const payload = { ...d, title, coverUrl }
  if (d.id) {
    await updateTopic(d.id, payload)
  } else {
    await createTopic(payload)
  }
  topicDialog.value = false
  ElMessage.success('已保存')
  loadTopics()
}

async function removeTopic(row: AdminTopic) {
  try {
    await ElMessageBox.confirm('确定删除该话题吗？删除后用户端筛选入口将同步隐藏。', '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteTopic(row.id)
  ElMessage.success('已删除')
  loadTopics()
}

async function toggleTopic(row: AdminTopic) {
  const target = row.status === 'on' ? 'off' : 'on'
  const label = target === 'on' ? '上线' : '下线'
  try {
    await ElMessageBox.confirm(`确定${label}话题「${row.title}」吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await updateTopic(row.id, { status: target })
  ElMessage.success(target === 'on' ? '已上线' : '已下线')
  loadTopics()
}

onMounted(loadBanners)
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="toolbar">
        <span class="card-title">运营管理</span>
        <el-radio-group v-model="activeTab" @change="switchTab">
          <el-radio-button value="banner">首页 Banner</el-radio-button>
          <el-radio-button value="column">内容专栏</el-radio-button>
          <el-radio-button value="topic">话题管理</el-radio-button>
        </el-radio-group>
      </div>
    </template>

    <!-- Banner -->
    <div v-if="activeTab === 'banner'">
      <div class="op-bar">
        <el-radio-group v-model="bannerQuery.status" size="small" @change="loadBanners">
          <el-radio-button value="">全部</el-radio-button>
          <el-radio-button value="on">启用</el-radio-button>
          <el-radio-button value="off">停用</el-radio-button>
        </el-radio-group>
        <el-button type="primary" @click="openBanner()">新增 Banner</el-button>
      </div>
      <el-table :data="banners" v-loading="bannerLoading" stripe>
        <el-table-column label="Banner" min-width="280">
          <template #default="{ row }">
            <div class="cell">
              <el-image :src="row.imageUrl" fit="cover" class="thumb" :preview-src-list="[row.imageUrl]" />
              <div class="meta">
                <span class="title">{{ row.title }}</span>
                <span class="sub">{{ row.position }} · 排序 {{ row.sort }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="跳转" min-width="160">
          <template #default="{ row }">{{ row.linkType }} {{ row.linkValue || '' }}</template>
        </el-table-column>
        <el-table-column label="投放时间" width="200">
          <template #default="{ row }">{{ row.startTime || '不限' }} ~ {{ row.endTime || '不限' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'on' ? 'success' : 'info'" size="small">
              {{ row.status === 'on' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="150" />
        <el-table-column label="操作" fixed="right" width="170">
          <template #default="{ row }">
            <el-button link type="primary" @click="openBanner(row)">编辑</el-button>
            <el-button link :type="row.status === 'on' ? 'warning' : 'success'" @click="toggleBanner(row)">
              {{ row.status === 'on' ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="removeBanner(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="bannerQuery.page"
          v-model:page-size="bannerQuery.size"
          :total="bannerTotal"
          layout="total, prev, pager, next"
          :page-sizes="[10]"
          @change="loadBanners"
        />
      </div>
    </div>

    <!-- 专栏 -->
    <div v-else-if="activeTab === 'column'">
      <div class="op-bar">
        <div class="filters">
          <el-radio-group v-model="columnQuery.status" size="small" @change="loadColumns">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="on">已发布</el-radio-button>
            <el-radio-button value="pending">待审核</el-radio-button>
            <el-radio-button value="off">草稿</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="columnQuery.keyword"
            placeholder="专栏标题"
            clearable
            style="width: 220px"
            @keyup.enter="loadColumns"
            @clear="loadColumns"
          >
            <template #append><el-button @click="loadColumns">搜索</el-button></template>
          </el-input>
        </div>
        <el-button type="primary" @click="openColumn()">新增专栏</el-button>
      </div>
      <el-table :data="columns" v-loading="columnLoading" stripe>
        <el-table-column label="专栏" min-width="260">
          <template #default="{ row }">
            <div class="cell">
              <el-image v-if="row.coverUrl" :src="row.coverUrl" fit="cover" class="thumb" />
              <div class="meta">
                <span class="title">{{ row.title }}</span>
                <span class="sub">{{ row.subtitle || '无副标题' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.type === 'weekly_pick' ? '每周好书' : '编辑专栏' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="排序" width="80" prop="sort" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'on' ? 'success' : 'info'" size="small">
              {{ row.status === 'on' ? '已发布' : row.status === 'pending' ? '待审核' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publishedAt" label="发布时间" width="150">
          <template #default="{ row }">{{ row.publishedAt || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="170">
          <template #default="{ row }">
            <el-button link type="primary" @click="openColumn(row)">编辑</el-button>
            <el-button link :type="row.status === 'on' ? 'warning' : 'success'" @click="toggleColumn(row)">
              {{ row.status === 'on' ? '下架' : '发布' }}
            </el-button>
            <el-button link type="danger" @click="removeColumn(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="columnQuery.page"
          v-model:page-size="columnQuery.size"
          :total="columnTotal"
          layout="total, prev, pager, next"
          :page-sizes="[10]"
          @change="loadColumns"
        />
      </div>
    </div>

    <!-- 话题 -->
    <div v-else-if="activeTab === 'topic'">
      <div class="op-bar">
        <div class="filters">
          <el-radio-group v-model="topicQuery.status" size="small" @change="loadTopics">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="on">已上线</el-radio-button>
            <el-radio-button value="off">已下线</el-radio-button>
          </el-radio-group>
          <el-input
            v-model="topicQuery.keyword"
            placeholder="话题名称"
            clearable
            style="width: 220px"
            @keyup.enter="loadTopics"
            @clear="loadTopics"
          >
            <template #append><el-button @click="loadTopics">搜索</el-button></template>
          </el-input>
        </div>
        <el-button type="primary" @click="openTopic()">新增话题</el-button>
      </div>
      <el-table :data="topics" v-loading="topicLoading" stripe>
        <el-table-column label="话题" min-width="260">
          <template #default="{ row }">
            <div class="cell">
              <el-image v-if="row.coverUrl" :src="row.coverUrl" fit="cover" class="thumb" />
              <div class="meta">
                <span class="title">{{ row.title }}</span>
                <span class="sub">{{ row.description || '无描述' }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="动态数" width="90" prop="postCount" />
        <el-table-column label="排序" width="80" prop="sort" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'on' ? 'success' : 'info'" size="small">
              {{ row.status === 'on' ? '已上线' : '已下线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" />
        <el-table-column label="操作" fixed="right" width="170">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTopic(row)">编辑</el-button>
            <el-button link :type="row.status === 'on' ? 'warning' : 'success'" @click="toggleTopic(row)">
              {{ row.status === 'on' ? '下线' : '上线' }}
            </el-button>
            <el-button link type="danger" @click="removeTopic(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="topicQuery.page"
          v-model:page-size="topicQuery.size"
          :total="topicTotal"
          layout="total, prev, pager, next"
          :page-sizes="[10]"
          @change="loadTopics"
        />
      </div>
    </div>

    <!-- Banner 弹窗 -->
    <el-dialog v-model="bannerDialog" :title="bannerForm.id ? '编辑 Banner' : '新增 Banner'" width="520">
      <el-form :model="bannerForm" label-width="80px">
        <el-form-item label="标题"><el-input v-model="bannerForm.title" /></el-form-item>
        <el-form-item label="图片 URL"><el-input v-model="bannerForm.imageUrl" placeholder="https://..." /></el-form-item>
        <el-form-item label="位置">
          <el-select v-model="bannerForm.position" style="width: 100%">
            <el-option label="首页顶部" value="home_top" />
            <el-option label="首页轮播" value="home_carousel" />
          </el-select>
        </el-form-item>
        <el-form-item label="跳转类型">
          <el-select v-model="bannerForm.linkType" style="width: 100%">
            <el-option label="无跳转" value="none" />
            <el-option label="站内页面" value="web" />
            <el-option label="书籍" value="book" />
            <el-option label="书单" value="booklist" />
          </el-select>
        </el-form-item>
        <el-form-item label="跳转值"><el-input v-model="bannerForm.linkValue" placeholder="路径 / 书籍 ID / URL" /></el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="bannerForm.sort" :min="0" :max="99" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bannerDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBanner">保存</el-button>
      </template>
    </el-dialog>

    <!-- 专栏弹窗 -->
    <el-dialog v-model="columnDialog" :title="columnForm.id ? '编辑专栏' : '新增专栏'" width="560">
      <el-form :model="columnForm" label-width="80px">
        <el-form-item label="类型">
          <el-radio-group v-model="columnForm.type">
            <el-radio-button value="editorial">编辑专栏</el-radio-button>
            <el-radio-button value="weekly_pick">每周好书</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="标题"><el-input v-model="columnForm.title" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="columnForm.subtitle" /></el-form-item>
        <el-form-item label="封面 URL"><el-input v-model="columnForm.coverUrl" placeholder="https://..." /></el-form-item>
        <el-form-item label="关联书籍"><el-input v-model="columnForm.bookId" placeholder="书籍 ID（可选）" /></el-form-item>
        <el-form-item label="正文">
          <el-input v-model="columnForm.content" type="textarea" :rows="4" placeholder="专栏文章正文（书单可留空）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="columnForm.sort" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="columnDialog = false">取消</el-button>
        <el-button type="primary" @click="saveColumn">保存</el-button>
      </template>
    </el-dialog>

    <!-- 话题弹窗 -->
    <el-dialog v-model="topicDialog" :title="topicForm.id ? '编辑话题' : '新增话题'" width="520">
      <el-form :model="topicForm" label-width="80px">
        <el-form-item label="话题名称"><el-input v-model="topicForm.title" placeholder="如：深夜书桌" /></el-form-item>
        <el-form-item label="话题描述">
          <el-input v-model="topicForm.description" type="textarea" :rows="3" placeholder="一句话说明话题主题（可选）" />
        </el-form-item>
        <el-form-item label="封面 URL"><el-input v-model="topicForm.coverUrl" placeholder="https://...（可选）" /></el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="topicForm.sort" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="topicDialog = false">取消</el-button>
        <el-button type="primary" @click="saveTopic">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<style scoped>
.card-title { font-size: 16px; font-weight: 600; color: #2d4a43; }
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.op-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.filters { display: flex; gap: 10px; align-items: center; }
.cell { display: flex; align-items: center; gap: 10px; }
.thumb { width: 56px; height: 36px; border-radius: 4px; flex-shrink: 0; background: #f0f2f1; }
.meta { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; }
.title { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { font-size: 12px; color: #99a59f; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>