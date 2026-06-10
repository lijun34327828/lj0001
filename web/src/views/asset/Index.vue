<template>
  <div class="asset-page">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <p class="stat-label">资产总值</p>
          <p class="stat-value">¥{{ formatMoney(stats.overview?.total_value) }}</p>
          <p class="stat-sub">当前价值 ¥{{ formatMoney(stats.overview?.total_current_value) }}</p>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <p class="stat-label">累计折旧</p>
          <p class="stat-value text-warning">¥{{ formatMoney(stats.overview?.total_depreciation) }}</p>
          <p class="stat-sub">折旧率 {{ (stats.overview?.depreciation_ratio * 100).toFixed(1) }}%</p>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <p class="stat-label">资产数量</p>
          <p class="stat-value text-primary">{{ stats.overview?.total_count || 0 }}</p>
          <p class="stat-sub">项资产</p>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <p class="stat-label">固定资产</p>
          <p class="stat-value">¥{{ formatMoney(stats.overview?.fixed_value) }}</p>
          <p class="stat-sub">占总资产 {{ totalValue > 0 ? ((stats.overview?.fixed_value / totalValue) * 100).toFixed(1) : 0 }}%</p>
        </div>
      </el-col>
    </el-row>

    <el-card class="table-card">
      <template #header>
        <div class="table-header">
          <span class="table-title">资产列表</span>
          <div class="header-actions">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索资产名称"
              clearable
              style="width: 200px"
              @clear="fetchAssets"
            />
            <el-select v-model="filterType" placeholder="全部类型" clearable style="width: 120px">
              <el-option label="固定资产" value="fixed" />
              <el-option label="流动资产" value="liquid" />
              <el-option label="无形资产" value="intangible" />
            </el-select>
            <el-button type="primary" :icon="Plus" @click="openAddDialog">新增资产</el-button>
          </div>
        </div>
      </template>

      <el-table :data="assets" v-loading="loading" stripe>
        <el-table-column prop="name" label="资产名称" min-width="150">
          <template #default="{ row }">
            <div class="asset-name">
              <span class="asset-icon">{{ getTypeIcon(row.type) }}</span>
              <span>{{ row.name }}</span>
              <el-tag 
                v-if="row.is_locked && !row.is_locked_by_self" 
                size="small" 
                type="info"
                effect="plain"
              >
                <el-icon><Lock /></el-icon>
                已锁定
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            {{ getTypeName(row.type) }}
          </template>
        </el-table-column>
        <el-table-column label="原值" width="120" align="right">
          <template #default="{ row }">
            ¥{{ formatMoney(row.value) }}
          </template>
        </el-table-column>
        <el-table-column label="当前价值" width="120" align="right">
          <template #default="{ row }">
            <span :class="{ 'text-warning': row.current_value < row.value }">
              ¥{{ formatMoney(row.current_value) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="purchase_date" label="购买日期" width="120" />
        <el-table-column prop="depreciation_rate" label="年折旧率" width="100" align="right">
          <template #default="{ row }">
            {{ row.depreciation_rate }}%
          </template>
        </el-table-column>
        <el-table-column prop="account_name" label="所属账户" width="120" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              type="primary" 
              link 
              size="small" 
              :disabled="row.is_locked && !row.is_locked_by_self"
              @click="handleEdit(row)"
            >
              编辑
            </el-button>
            <el-button 
              type="success" 
              link 
              size="small"
              :disabled="row.is_locked && row.is_locked_by_self"
              @click="handleLock(row)"
            >
              {{ row.is_locked && row.is_locked_by_self ? '已锁定' : '锁定' }}
            </el-button>
            <el-button 
              type="danger" 
              link 
              size="small"
              :disabled="row.is_locked && !row.is_locked_by_self"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchAssets"
          @current-change="fetchAssets"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑资产' : '新增资产'"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="资产名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入资产名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="资产类型" prop="type">
          <el-radio-group v-model="form.type">
            <el-radio value="fixed">固定资产</el-radio>
            <el-radio value="liquid">流动资产</el-radio>
            <el-radio value="intangible">无形资产</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="所属账户" prop="account_id">
          <el-select v-model="form.account_id" placeholder="请选择账户" style="width: 100%">
            <el-option
              v-for="acc in accounts"
              :key="acc.id"
              :label="acc.name"
              :value="acc.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="资产价值" prop="value">
          <el-input-number
            v-model="form.value"
            :min="0"
            :max="999999999.99"
            :precision="2"
            :step="100"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="购买日期">
          <el-date-picker
            v-model="form.purchase_date"
            type="date"
            placeholder="选择购买日期"
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </el-form-item>
        <el-form-item label="年折旧率">
          <el-input-number
            v-model="form.depreciation_rate"
            :min="0"
            :max="100"
            :precision="2"
            :step="1"
            style="width: 100%"
          />
          <span class="form-tip">设置后系统会自动计算当前价值，单位：%</span>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="选填"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="handleClose">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ isEdit ? '保存' : '确认添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Lock } from '@element-plus/icons-vue'
import { getAssets, createAsset, updateAsset, deleteAsset, lockAsset, unlockAsset, getAssetStats } from '@/api/asset'
import { getAccounts } from '@/api/account'
import { formatMoney } from '@/utils'

const loading = ref(false)
const assets = ref([])
const accounts = ref([])
const stats = ref({ overview: {} })
const searchKeyword = ref('')
const filterType = ref('')
const formVisible = ref(false)
const formRef = ref(null)
const isEdit = ref(false)
const editId = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  type: 'fixed',
  account_id: null,
  value: null,
  purchase_date: null,
  depreciation_rate: 0,
  description: ''
})

const rules = {
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择资产类型', trigger: 'change' }],
  account_id: [{ required: true, message: '请选择所属账户', trigger: 'change' }],
  value: [{ required: true, message: '请输入资产价值', trigger: 'blur' }]
}

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const totalValue = computed(() => stats.value.overview?.total_value || 0)

const typeIcons = {
  fixed: '🏠',
  liquid: '💵',
  intangible: '📝'
}

const typeNames = {
  fixed: '固定资产',
  liquid: '流动资产',
  intangible: '无形资产'
}

function getTypeIcon(type) {
  return typeIcons[type] || '📦'
}

function getTypeName(type) {
  return typeNames[type] || type
}

const disabledDate = (time) => {
  return time.getTime() > Date.now() + 86400000
}

async function fetchStats() {
  try {
    const res = await getAssetStats()
    if (res.code === 200) {
      stats.value = res.data
    }
  } catch (e) {}
}

async function fetchAccounts() {
  try {
    const res = await getAccounts()
    if (res.code === 200) {
      accounts.value = res.data || []
    }
  } catch (e) {}
}

async function fetchAssets() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      keyword: searchKeyword.value || undefined,
      type: filterType.value || undefined
    }
    
    const res = await getAssets(params)
    if (res.code === 200) {
      assets.value = res.data.list || []
      pagination.total = res.data.total || 0
    }
  } finally {
    loading.value = false
  }
}

function openAddDialog() {
  isEdit.value = false
  editId.value = null
  form.name = ''
  form.type = 'fixed'
  form.account_id = accounts.value[0]?.id || null
  form.value = null
  form.purchase_date = null
  form.depreciation_rate = 0
  form.description = ''
  formVisible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
}

async function handleEdit(row) {
  if (row.is_locked && !row.is_locked_by_self) {
    ElMessage.warning('该资产正在被其他用户编辑，请稍后再试')
    return
  }

  if (!row.is_locked) {
    try {
      const lockRes = await lockAsset(row.id)
      if (lockRes.code !== 200) {
        ElMessage.warning('锁定失败，请稍后再试')
        return
      }
    } catch (e) {
      if (e.response?.status === 409) {
        ElMessage.warning('资产正在被其他用户编辑')
        return
      }
    }
  }

  isEdit.value = true
  editId.value = row.id
  form.name = row.name
  form.type = row.type
  form.account_id = row.account_id
  form.value = Number(row.value)
  form.purchase_date = row.purchase_date
  form.depreciation_rate = Number(row.depreciation_rate) || 0
  form.description = row.description || ''
  formVisible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
}

function handleClose() {
  if (isEdit.value && editId.value) {
    unlockAsset(editId.value).catch(() => {})
  }
  formVisible.value = false
}

async function handleSubmit() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    let res
    if (isEdit.value) {
      res = await updateAsset(editId.value, form)
    } else {
      res = await createAsset(form)
    }

    if (res.code === 200) {
      ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
      formVisible.value = false
      fetchAssets()
      fetchStats()
    }
  } finally {
    submitting.value = false
  }
}

async function handleLock(row) {
  if (row.is_locked && row.is_locked_by_self) {
    try {
      const res = await unlockAsset(row.id)
      if (res.code === 200) {
        ElMessage.success('已解锁')
        fetchAssets()
      }
    } catch (e) {}
    return
  }

  try {
    const res = await lockAsset(row.id)
    if (res.code === 200) {
      ElMessage.success('已锁定，30分钟内其他用户无法编辑')
      fetchAssets()
    }
  } catch (e) {
    if (e.response?.status === 409) {
      ElMessage.warning('资产正在被其他用户编辑')
    }
  }
}

async function handleDelete(row) {
  if (row.is_locked && !row.is_locked_by_self) {
    ElMessage.warning('该资产正在被其他用户编辑，无法删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除资产「${row.name}」吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    const res = await deleteAsset(row.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchAssets()
      fetchStats()
    }
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  fetchAccounts()
  fetchStats()
  fetchAssets()
})
</script>

<style scoped>
.asset-page {
  padding: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.stat-sub {
  font-size: 12px;
  color: #909399;
}

.text-primary {
  color: #409eff;
}

.text-warning {
  color: #e6a23c;
}

.table-card {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-title {
  font-weight: 600;
  font-size: 15px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.asset-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asset-icon {
  font-size: 18px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  display: block;
}
</style>
