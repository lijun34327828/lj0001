<template>
  <div class="bill-page">
    <el-card class="filter-card">
      <el-form :model="filters" inline>
        <el-form-item label="类型">
          <el-select v-model="filters.type" placeholder="全部" clearable style="width: 100px">
            <el-option label="收入" value="income" />
            <el-option label="支出" value="expense" />
          </el-select>
        </el-form-item>
        <el-form-item label="账户">
          <el-select v-model="filters.accountId" placeholder="全部账户" clearable style="width: 140px">
            <el-option 
              v-for="acc in accounts" 
              :key="acc.id" 
              :label="acc.name" 
              :value="acc.id" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-cascader
            v-model="categoryValue"
            :options="categoryTree"
            :props="{ value: 'id', label: 'name', children: 'children' }"
            placeholder="全部分类"
            clearable
            style="width: 180px"
            @change="handleCategoryChange"
          />
        </el-form-item>
        <el-form-item label="时间区间">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 260px"
            @change="handleDateChange"
          />
        </el-form-item>
        <el-form-item label="关键词">
          <el-input 
            v-model="filters.keyword" 
            placeholder="描述/分类" 
            clearable 
            style="width: 160px"
            @clear="fetchBills"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="fetchBills">查询</el-button>
          <el-button :icon="Refresh" @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="table-header">
          <span class="table-title">账单列表</span>
          <div class="table-actions">
            <el-button type="primary" :icon="Plus" @click="openAddDialog">记一笔</el-button>
            <el-button type="success" :icon="Upload" @click="openImportDialog">批量导入</el-button>
            <el-button type="danger" :icon="Delete" :disabled="selectedIds.length === 0" @click="batchDelete">
              批量删除
            </el-button>
          </div>
        </div>
      </template>

      <el-table
        :data="bills"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        stripe
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="bill_time" label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.bill_time, 'YYYY-MM-DD HH:mm') }}
          </template>
        </el-table-column>
        <el-table-column label="分类" width="140">
          <template #default="{ row }">
            <span class="category-tag">
              {{ row.category_icon || '📊' }}
              {{ row.category_name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.type === 'income' ? 'success' : 'danger'" size="small">
              {{ row.type === 'income' ? '收入' : '支出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            <span :class="row.type === 'income' ? 'money-income' : 'money-expense'">
              {{ row.type === 'income' ? '+' : '-' }}¥{{ formatMoney(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="account_name" label="账户" width="120" />
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchBills"
          @current-change="fetchBills"
        />
      </div>
    </el-card>

    <bill-form-dialog
      ref="formDialogRef"
      :accounts="accounts"
      :category-tree="categoryTree"
      @success="handleFormSuccess"
    />

    <import-dialog
      ref="importDialogRef"
      :accounts="accounts"
      @success="handleImportSuccess"
    />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Upload, Delete } from '@element-plus/icons-vue'
import { getBills, deleteBill, batchDeleteBills } from '@/api/bill'
import { getAccounts } from '@/api/account'
import { getCategories } from '@/api/category'
import { formatMoney, formatDate } from '@/utils'
import BillFormDialog from './components/BillFormDialog.vue'
import ImportDialog from './components/ImportDialog.vue'

const loading = ref(false)
const bills = ref([])
const accounts = ref([])
const categoryTree = ref([])
const selectedIds = ref([])
const categoryValue = ref([])
const dateRange = ref([])
const formDialogRef = ref(null)
const importDialogRef = ref(null)

const filters = reactive({
  type: '',
  accountId: '',
  categoryId: '',
  startDate: '',
  endDate: '',
  keyword: '',
  minAmount: '',
  maxAmount: ''
})

const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

async function fetchAccounts() {
  try {
    const res = await getAccounts()
    if (res.code === 200) {
      accounts.value = res.data || []
    }
  } catch (e) {}
}

async function fetchCategories() {
  try {
    const res = await getCategories()
    if (res.code === 200) {
      categoryTree.value = res.data || []
    }
  } catch (e) {}
}

async function fetchBills() {
  loading.value = true
  try {
    const params = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...filters
    }
    
    const res = await getBills(params)
    if (res.code === 200) {
      bills.value = res.data.list || []
      pagination.total = res.data.total || 0
    }
  } finally {
    loading.value = false
  }
}

function handleCategoryChange(val) {
  if (val && val.length > 0) {
    filters.categoryId = val[val.length - 1]
  } else {
    filters.categoryId = ''
  }
}

function handleDateChange(val) {
  if (val && val.length === 2) {
    filters.startDate = val[0]
    filters.endDate = val[1]
  } else {
    filters.startDate = ''
    filters.endDate = ''
  }
}

function resetFilters() {
  filters.type = ''
  filters.accountId = ''
  filters.categoryId = ''
  filters.startDate = ''
  filters.endDate = ''
  filters.keyword = ''
  categoryValue.value = []
  dateRange.value = []
  pagination.page = 1
  fetchBills()
}

function handleSelectionChange(selection) {
  selectedIds.value = selection.map(item => item.id)
}

function openAddDialog() {
  formDialogRef.value?.open()
}

function openEditDialog(row) {
  formDialogRef.value?.open(row)
}

function openImportDialog() {
  importDialogRef.value?.open()
}

function handleFormSuccess() {
  fetchBills()
}

function handleImportSuccess() {
  fetchBills()
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除这条账单吗？删除后无法恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
    
    const res = await deleteBill(row.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchBills()
    }
  } catch {
    // 取消删除
  }
}

async function batchDelete() {
  if (selectedIds.value.length === 0) return
  
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedIds.value.length} 条账单吗？此操作不可恢复。`,
      '批量删除确认',
      { type: 'warning' }
    )
    
    const res = await batchDeleteBills(selectedIds.value)
    if (res.code === 200) {
      ElMessage.success(`成功删除${res.data.deleted}条记录`)
      selectedIds.value = []
      fetchBills()
    }
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  fetchAccounts()
  fetchCategories()
  fetchBills()
})
</script>

<style scoped>
.bill-page {
  padding: 0;
}

.filter-card {
  margin-bottom: 20px;
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

.table-actions {
  display: flex;
  gap: 10px;
}

.category-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.money-income {
  color: #67c23a;
  font-weight: 500;
}

.money-expense {
  color: #f56c6c;
  font-weight: 500;
}
</style>
