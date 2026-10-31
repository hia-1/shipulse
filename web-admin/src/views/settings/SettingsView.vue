<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSettings,
  updateProfile,
  changePassword,
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getRoles,
  createRole,
  updateRole,
  getOperationLogs,
  type SettingsOverview,
  type AdminAccount,
  type AdminRoleItem,
  type OperationLogItem,
} from '@/api/adminManage'

const active = ref<'profile' | 'accounts' | 'roles' | 'logs'>('profile')

/* ---------- 个人资料 ---------- */
const overview = ref<SettingsOverview | null>(null)
const loading = ref(false)
const profile = reactive({ name: '', avatarUrl: '' })
async function saveProfile() {
  try {
    await updateProfile({ name: profile.name, avatarUrl: profile.avatarUrl })
    ElMessage.success('资料已更新')
  } catch {
    // 失败提示由 http 拦截器统一弹出
  }
}

/* ---------- 修改密码 ---------- */
const pwd = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const pwdSaving = ref(false)
async function savePassword() {
  if (!pwd.oldPassword || !pwd.newPassword) {
    ElMessage.warning('请填写旧密码和新密码')
    return
  }
  if (pwd.newPassword !== pwd.confirm) {
    ElMessage.warning('两次输入的新密码不一致')
    return
  }
  try {
    await ElMessageBox.confirm('确定修改密码吗？修改后需要重新登录。', '提示', { type: 'warning' })
  } catch {
    return
  }
  pwdSaving.value = true
  try {
    await changePassword({ oldPassword: pwd.oldPassword, newPassword: pwd.newPassword })
    ElMessage.success('密码已修改')
    Object.assign(pwd, { oldPassword: '', newPassword: '', confirm: '' })
  } finally {
    pwdSaving.value = false
  }
}

const yuan = (fen: number) => (fen / 100).toFixed(2)

/* ---------- 角色（供账号分配） ---------- */
const roles = ref<AdminRoleItem[]>([])
async function loadRoles() {
  const res = await getRoles()
  roles.value = res.data
}

/* ---------- 管理员账号 ---------- */
const accounts = ref<AdminAccount[]>([])
const accountTotal = ref(0)
const accountQuery = reactive({ page: 1, size: 10, keyword: '' })
const accountLoading = ref(false)
const accountDialog = ref(false)
const editingAdminId = ref<number | null>(null)
const accountForm = reactive({ username: '', password: '', name: '', roleCodes: [] as string[] })

async function loadAccounts() {
  accountLoading.value = true
  try {
    const res = await getAccounts({ ...accountQuery })
    accounts.value = res.data.items
    accountTotal.value = res.data.total
  } finally {
    accountLoading.value = false
  }
}

function openCreateAccount() {
  editingAdminId.value = null
  Object.assign(accountForm, { username: '', password: '', name: '', roleCodes: [] })
  accountDialog.value = true
}

function openEditAccount(row: AdminAccount) {
  editingAdminId.value = row.id
  Object.assign(accountForm, {
    username: row.username,
    password: '',
    name: row.name,
    roleCodes: [...row.roles],
  })
  accountDialog.value = true
}

async function submitAccount() {
  if (!accountForm.username.trim()) {
    ElMessage.warning('请填写登录名')
    return
  }
  if (editingAdminId.value) {
    const payload: Record<string, unknown> = { name: accountForm.name, roleCodes: accountForm.roleCodes }
    if (accountForm.password) payload.password = accountForm.password
    await updateAccount(editingAdminId.value, payload)
    ElMessage.success('管理员已更新（权限变更需重新登录生效）')
  } else {
    if (accountForm.password.length < 6) {
      ElMessage.warning('密码至少 6 位')
      return
    }
    await createAccount({
      username: accountForm.username,
      password: accountForm.password,
      name: accountForm.name,
      roleCodes: accountForm.roleCodes,
    })
    ElMessage.success('管理员已创建')
  }
  accountDialog.value = false
  loadAccounts()
}

async function toggleAccountStatus(row: AdminAccount) {
  const next = row.status === 'active' ? 'disabled' : 'active'
  try {
    await ElMessageBox.confirm(`确定${next === 'active' ? '启用' : '停用'}账号「${row.username}」吗？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  await updateAccount(row.id, { status: next })
  ElMessage.success('状态已更新')
  loadAccounts()
}

async function removeAccount(row: AdminAccount) {
  try {
    await ElMessageBox.confirm(`确定删除管理员「${row.username}」吗？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  await deleteAccount(row.id)
  ElMessage.success('已删除')
  loadAccounts()
}

/* ---------- 角色权限 ---------- */
const roleDialog = ref(false)
const editingRoleId = ref<number | null>(null)
const roleForm = reactive({ code: '', name: '', description: '', permissionsText: '', status: 'active' })
const PERMISSION_OPTIONS = [
  'dashboard:view',
  'user:read',
  'book:*',
  'review:audit',
  'post:audit',
  'comment:audit',
  'report:*',
  'report:read',
  'report:handle',
  'banner:*',
  'column:*',
  'event:*',
  'order:*',
  'redeem:*',
  'member:*',
  'feedback:*',
]

function openCreateRole() {
  editingRoleId.value = null
  Object.assign(roleForm, { code: '', name: '', description: '', permissionsText: '', status: 'active' })
  roleDialog.value = true
}

function openEditRole(row: AdminRoleItem) {
  editingRoleId.value = row.id
  Object.assign(roleForm, {
    code: row.code,
    name: row.name,
    description: row.description,
    permissionsText: row.permissions.join(', '),
    status: row.status,
  })
  roleDialog.value = true
}

function parsePermissions(text: string): string[] {
  return text
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function submitRole() {
  if (!roleForm.name.trim()) {
    ElMessage.warning('请填写角色名称')
    return
  }
  const permissions = parsePermissions(roleForm.permissionsText)
  if (editingRoleId.value) {
    await updateRole(editingRoleId.value, {
      name: roleForm.name,
      description: roleForm.description,
      permissions,
      status: roleForm.status,
    })
    ElMessage.success('角色已更新（绑定该角色的管理员需重新登录生效）')
  } else {
    if (!roleForm.code.trim()) {
      ElMessage.warning('请填写角色编码')
      return
    }
    await createRole({
      code: roleForm.code.trim(),
      name: roleForm.name,
      description: roleForm.description,
      permissions,
      status: roleForm.status,
    })
    ElMessage.success('角色已创建')
  }
  roleDialog.value = false
  await loadRoles()
  loadAccounts()
}

/* ---------- 操作日志 ---------- */
const logs = ref<OperationLogItem[]>([])
const logTotal = ref(0)
const logQuery = reactive({ page: 1, size: 10, module: '', keyword: '' })
const logLoading = ref(false)
async function loadLogs() {
  logLoading.value = true
  try {
    const res = await getOperationLogs({ ...logQuery })
    logs.value = res.data.items
    logTotal.value = res.data.total
  } finally {
    logLoading.value = false
  }
}

function onTabChange(name: string | number) {
  if (name === 'accounts') loadAccounts()
  else if (name === 'roles') loadRoles()
  else if (name === 'logs') loadLogs()
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getSettings()
    overview.value = res.data
    profile.name = res.data.profile.name || ''
    profile.avatarUrl = res.data.profile.avatarUrl || ''
    await loadRoles()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <el-tabs v-model="active" @tab-change="onTabChange">
    <!-- 个人设置 -->
    <el-tab-pane label="个人设置" name="profile">
      <el-row :gutter="16" v-loading="loading">
        <el-col :span="14">
          <el-card shadow="never" class="block">
            <template #header><span class="card-title">管理员资料</span></template>
            <el-form label-width="90px" class="form">
              <el-form-item label="用户名">
                <el-input :model-value="overview?.profile.username || ''" disabled />
              </el-form-item>
              <el-form-item label="显示名称">
                <el-input v-model="profile.name" placeholder="显示名称" />
              </el-form-item>
              <el-form-item label="头像 URL">
                <el-input v-model="profile.avatarUrl" placeholder="https://..." />
              </el-form-item>
              <el-form-item label="最近登录">
                <span class="muted">{{ overview?.profile.lastLoginAt || '—' }}</span>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveProfile">保存资料</el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <el-card shadow="never" class="block">
            <template #header><span class="card-title">修改密码</span></template>
            <el-form label-width="90px" class="form">
              <el-form-item label="旧密码">
                <el-input v-model="pwd.oldPassword" type="password" show-password placeholder="当前密码" />
              </el-form-item>
              <el-form-item label="新密码">
                <el-input v-model="pwd.newPassword" type="password" show-password placeholder="新密码" />
              </el-form-item>
              <el-form-item label="确认密码">
                <el-input v-model="pwd.confirm" type="password" show-password placeholder="再次输入新密码" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="pwdSaving" @click="savePassword">修改密码</el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <el-col :span="10">
          <el-card shadow="never" class="block">
            <template #header><span class="card-title">会员套餐</span></template>
            <el-empty v-if="!overview?.plans?.length" description="暂无会员套餐" :image-size="80" />
            <div v-else class="plan-list">
              <div v-for="p in overview.plans" :key="p.id" class="plan-item">
                <div class="plan-name">{{ p.name }}</div>
                <div class="plan-meta">
                  <el-tag size="small" type="info">{{ p.durationDays }} 天</el-tag>
                  <span class="plan-price">¥{{ yuan(p.priceFen) }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-tab-pane>

    <!-- 管理员账号 -->
    <el-tab-pane label="管理员账号" name="accounts">
      <el-card shadow="never">
        <template #header>
          <div class="toolbar">
            <el-input v-model="accountQuery.keyword" placeholder="登录名/姓名" clearable style="width: 200px" @change="loadAccounts" />
            <el-button type="primary" @click="openCreateAccount">新建管理员</el-button>
          </div>
        </template>
        <el-table :data="accounts" v-loading="accountLoading" stripe>
          <el-table-column prop="username" label="登录名" width="150" />
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column label="角色" min-width="180">
            <template #default="{ row }">
              <el-tag v-for="r in row.roles" :key="r" size="small" class="role-tag">{{ r }}</el-tag>
              <span v-if="!row.roles.length" class="muted">未分配</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                {{ row.status === 'active' ? '启用' : '停用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="lastLoginAt" label="最近登录" width="170" />
          <el-table-column label="操作" fixed="right" width="200">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditAccount(row)">编辑</el-button>
              <el-button link :type="row.status === 'active' ? 'warning' : 'success'" @click="toggleAccountStatus(row)">
                {{ row.status === 'active' ? '停用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="removeAccount(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pager">
          <el-pagination
            v-model:current-page="accountQuery.page"
            v-model:page-size="accountQuery.size"
            :total="accountTotal"
            layout="total, prev, pager, next"
            @change="loadAccounts"
          />
        </div>
      </el-card>
    </el-tab-pane>

    <!-- 角色权限 -->
    <el-tab-pane label="角色权限" name="roles">
      <el-card shadow="never">
        <template #header>
          <div class="toolbar">
            <span class="muted">权限点支持资源通配（如 book:*）与全部权限（*）</span>
            <el-button type="primary" @click="openCreateRole">新建角色</el-button>
          </div>
        </template>
        <el-table :data="roles" stripe>
          <el-table-column prop="code" label="编码" width="160" />
          <el-table-column prop="name" label="名称" width="140" />
          <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
          <el-table-column label="权限点" min-width="240">
            <template #default="{ row }">
              <el-tag v-for="p in row.permissions" :key="p" size="small" class="perm-tag">{{ p }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="类型" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.isBuiltin ? 'warning' : 'info'">{{ row.isBuiltin ? '内置' : '自定义' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditRole(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </el-tab-pane>

    <!-- 操作日志 -->
    <el-tab-pane label="操作日志" name="logs">
      <el-card shadow="never">
        <template #header>
          <div class="toolbar">
            <div class="filters">
              <el-input v-model="logQuery.module" placeholder="模块（如 users）" clearable style="width: 180px" @change="loadLogs" />
              <el-input v-model="logQuery.keyword" placeholder="路径/动作/登录名" clearable style="width: 220px" @change="loadLogs" />
            </div>
            <el-button @click="loadLogs">刷新</el-button>
          </div>
        </template>
        <el-table :data="logs" v-loading="logLoading" stripe>
          <el-table-column prop="createdAt" label="时间" width="170" />
          <el-table-column prop="module" label="模块" width="100" />
          <el-table-column prop="method" label="方法" width="80" />
          <el-table-column prop="path" label="路径" min-width="200" show-overflow-tooltip />
          <el-table-column prop="adminId" label="管理员ID" width="100" />
          <el-table-column prop="ip" label="IP" width="140" />
          <el-table-column label="状态码" width="90">
            <template #default="{ row }">
              <el-tag size="small" :type="row.statusCode < 400 ? 'success' : 'danger'">{{ row.statusCode }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="durationMs" label="耗时(ms)" width="100" />
        </el-table>
        <div class="pager">
          <el-pagination
            v-model:current-page="logQuery.page"
            v-model:page-size="logQuery.size"
            :total="logTotal"
            layout="total, prev, pager, next"
            @change="loadLogs"
          />
        </div>
      </el-card>
    </el-tab-pane>
  </el-tabs>

  <!-- 管理员账号编辑弹窗 -->
  <el-dialog v-model="accountDialog" :title="editingAdminId ? '编辑管理员' : '新建管理员'" width="480px">
    <el-form label-width="90px">
      <el-form-item label="登录名" required>
        <el-input v-model="accountForm.username" :disabled="!!editingAdminId" placeholder="登录名" />
      </el-form-item>
      <el-form-item :label="editingAdminId ? '重置密码' : '密码'" :required="!editingAdminId">
        <el-input v-model="accountForm.password" type="password" show-password placeholder="至少 6 位" />
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model="accountForm.name" placeholder="显示名称" />
      </el-form-item>
      <el-form-item label="角色">
        <el-select v-model="accountForm.roleCodes" multiple placeholder="选择角色" style="width: 100%">
          <el-option v-for="r in roles" :key="r.code" :label="`${r.name}（${r.code}）`" :value="r.code" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="accountDialog = false">取消</el-button>
      <el-button type="primary" @click="submitAccount">保存</el-button>
    </template>
  </el-dialog>

  <!-- 角色编辑弹窗 -->
  <el-dialog v-model="roleDialog" :title="editingRoleId ? '编辑角色' : '新建角色'" width="520px">
    <el-form label-width="90px">
      <el-form-item label="角色编码" :required="!editingRoleId">
        <el-input v-model="roleForm.code" :disabled="!!editingRoleId" placeholder="如 content_ops" />
      </el-form-item>
      <el-form-item label="角色名称" required>
        <el-input v-model="roleForm.name" placeholder="角色名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="roleForm.description" placeholder="角色描述" />
      </el-form-item>
      <el-form-item label="权限点">
        <el-select
          v-model="roleForm.permissionsText"
          multiple
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入权限点"
          style="width: 100%"
        >
          <el-option v-for="p in PERMISSION_OPTIONS" :key="p" :label="p" :value="p" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-radio-group v-model="roleForm.status">
          <el-radio-button value="active">启用</el-radio-button>
          <el-radio-button value="disabled">停用</el-radio-button>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="roleDialog = false">取消</el-button>
      <el-button type="primary" @click="submitRole">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.card-title { font-size: 16px; font-weight: 600; color: #2d4a43; }
.block { margin-bottom: 16px; }
.block + .block { margin-bottom: 0; }
.form { max-width: 460px; }
.muted { color: #99a59f; font-size: 13px; }
.plan-list { display: flex; flex-direction: column; gap: 12px; }
.plan-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #eceef2;
  border-radius: 8px;
}
.plan-name { font-weight: 500; }
.plan-meta { display: flex; align-items: center; gap: 10px; }
.plan-price { font-size: 15px; font-weight: 600; color: #c9514b; }
.toolbar { display: flex; align-items: center; justify-content: space-between; }
.filters { display: flex; gap: 10px; }
.pager { display: flex; justify-content: flex-end; margin-top: 16px; }
.role-tag { margin-right: 6px; }
.perm-tag { margin: 0 6px 6px 0; }
</style>
