<template>
  <div class="budget-page">
    <el-card class="header-card">
      <div class="header-content">
        <div class="date-picker">
          <el-date-picker
            v-model="currentDate"
            type="month"
            placeholder="选择月份"
            format="YYYY年MM月"
            value-format="YYYY-MM"
            size="large"
            @change="fetchData"
          />
        </div>
        <div class="header-actions">
          <el-button :icon="CopyDocument" @click="openCopyDialog">复制上月预算</el-button>
          <el-button type="primary" :icon="Plus" @click="openAddDialog">设置预算</el-button>
        </div>
      </div>

      <el-row :gutter="20" class="summary-row">
        <el-col :span="8">
          <div class="summary-item">
            <p class="summary-label">总预算</p>
            <p class="summary-value">¥{{ formatMoney(totalBudget) }}</p>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-item">
            <p class="summary-label">已支出</p>
            <p class="summary-value expense">¥{{ formatMoney(totalSpent) }}</p>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-item">
            <p class="summary-label">剩余预算</p>
            <p class="summary-value" :class="{ negative: totalRemaining < 0 }">
              ¥{{ formatMoney(totalRemaining) }}
            </p>
          </div>
        </el-col>
      </el-row>

      <el-progress 
        :percentage="overallPercent" 
        :status="overallPercent >= 100 ? 'exception' : overallPercent >= 80 ? 'warning' : ''"
        :stroke-width="12"
      />
    </el-card>

    <el-card class="list-card">
      <template #header>
        <span class="card-title">分类预算</span>
      </template>

      <div v-loading="loading" class="budget-list">
        <div v-if="budgets.length === 0" class="empty-state">
          <el-empty description="暂无预算设置" :image-size="100" />
          <el-button type="primary" @click="openAddDialog">立即设置</el-button>
        </div>

        <div 
          v-for="budget in budgets" 
          :key="budget.id" 
          class="budget-item"
          :class="{ warning: budget.level === 'warning', exceed: budget.level === 'exceed' }"
        >
          <div class="item-header">
            <div class="item-left">
              <span class="item-icon">{{ budget.category_icon || '📊' }}</span>
              <span class="item-name">{{ budget.category_name }}</span>
              <el-tag 
                v-if="budget.level === 'exceed'" 
                type="danger" 
                size="small"
                effect="light"
              >
                已超支
              </el-tag>
              <el-tag 
                v-else-if="budget.level === 'warning'" 
                type="warning" 
                size="small"
                effect="light"
              >
                预警
              </el-tag>
            </div>
            <div class="item-right">
              <el-button type="primary" link size="small" @click="openEditDialog(budget)">
                修改
              </el-button>
              <el-button type="danger" link size="small" @click="handleDelete(budget)">
                删除
              </el-button>
            </div>
          </div>

          <div class="item-progress">
            <el-progress 
              :percentage="Math.min(budget.ratio * 100, 100)" 
              :status="budget.level === 'exceed' ? 'exception' : budget.level === 'warning' ? 'warning' : ''"
              :stroke-width="8"
            />
          </div>

          <div class="item-footer">
            <div class="stat">
              <span class="label">预算</span>
              <span class="value">¥{{ formatMoney(budget.amount) }}</span>
            </div>
            <div class="stat">
              <span class="label">已用</span>
              <span class="value expense">¥{{ formatMoney(budget.spent) }}</span>
            </div>
            <div class="stat">
              <span class="label">剩余</span>
              <span class="value" :class="{ negative: budget.remaining < 0 }">
                ¥{{ formatMoney(budget.remaining) }}
              </span>
            </div>
            <div class="stat">
              <span class="label">占比</span>
              <span class="value">{{ (budget.ratio * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '修改预算' : '设置预算'"
      width="460px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="分类" prop="category_id">
          <el-select 
            v-model="form.category_id" 
            placeholder="请选择支出分类"
            style="width: 100%"
            filterable
          >
            <el-option
              v-for="cat in expenseCategories"
              :key="cat.id"
              :label="cat.name"
              :value="cat.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="预算金额" prop="amount">
          <el-input-number
            v-model="form.amount"
            :min="0"
            :max="999999999.99"
            :precision="2"
            :step="100"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="月份">
          <span>{{ currentDate }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="copyVisible"
      title="复制预算"
      width="360px"
    >
      <el-form label-width="80px">
        <el-form-item label="源月份">
          <el-date-picker
            v-model="copyFromDate"
            type="month"
            placeholder="选择源月份"
            format="YYYY年MM月"
            value-format="YYYY-MM"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="目标月份">
          <span>{{ currentDate }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="copyVisible = false">取消</el-button>
        <el-button type="primary" :loading="copying" @click="handleCopy">复制</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CopyDocument } from '@element-plus/icons-vue'
import { getBudgets, setBudget, deleteBudget, copyBudget } from '@/api/budget'
import { getCategoryList } from '@/api/category'
import { formatMoney } from '@/utils'
import dayjs from 'dayjs'

const loading = ref(false)
const budgets = ref([])
const expenseCategories = ref([])
const currentDate = ref(dayjs().format('YYYY-MM'))
const formVisible = ref(false)
const formRef = ref(null)
const isEdit = ref(false)
const editId = ref(null)
const submitting = ref(false)
const copyVisible = ref(false)
const copyFromDate = ref('')
const copying = ref(false)

const form = reactive({
  category_id: null,
  amount: null
})

const rules = {
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
  amount: [
    { required: true, message: '请输入预算金额', trigger: 'blur' },
    { type: 'number', min: 0, message: '预算金额不能为负', trigger: 'blur' }
  ]
}

const totalBudget = computed(() => {
  return budgets.value.reduce((sum, b) => sum + Number(b.amount), 0)
})

const totalSpent = computed(() => {
  return budgets.value.reduce((sum, b) => sum + Number(b.spent), 0)
})

const totalRemaining = computed(() => {
  return totalBudget.value - totalSpent.value
})

const overallPercent = computed(() => {
  if (totalBudget.value === 0) return 0
  return Math.round((totalSpent.value / totalBudget.value) * 10000) / 100
})

async function fetchCategories() {
  try {
    const res = await getCategoryList({ type: 'expense' })
    if (res.code === 200) {
      expenseCategories.value = (res.data || []).filter(c => c.level > 1 || 
        !res.data.some(child => child.parent_id === c.id)
      )
    }
  } catch (e) {}
}

async function fetchData() {
  loading.value = true
  try {
    const [year, month] = currentDate.value.split('-').map(Number)
    const res = await getBudgets({ year, month })
    if (res.code === 200) {
      budgets.value = res.data.list || []
    }
  } finally {
    loading.value = false
  }
}

function openAddDialog() {
  isEdit.value = false
  editId.value = null
  form.category_id = null
  form.amount = null
  formVisible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
}

function openEditDialog(budget) {
  isEdit.value = true
  editId.value = budget.id
  form.category_id = budget.category_id
  form.amount = Number(budget.amount)
  formVisible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
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
    const [year, month] = currentDate.value.split('-').map(Number)
    const res = await setBudget({
      category_id: form.category_id,
      amount: form.amount,
      year,
      month
    })
    
    if (res.code === 200) {
      ElMessage.success(isEdit.value ? '修改成功' : '设置成功')
      formVisible.value = false
      fetchData()
    }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(budget) {
  try {
    await ElMessageBox.confirm(
      `确定要删除「${budget.category_name}」的预算吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    const res = await deleteBudget(budget.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchData()
    }
  } catch {
    // 取消删除
  }
}

function openCopyDialog() {
  const prevMonth = dayjs(currentDate.value).subtract(1, 'month').format('YYYY-MM')
  copyFromDate.value = prevMonth
  copyVisible.value = true
}

async function handleCopy() {
  if (!copyFromDate.value) {
    ElMessage.warning('请选择源月份')
    return
  }

  const [fromYear, fromMonth] = copyFromDate.value.split('-').map(Number)
  const [toYear, toMonth] = currentDate.value.split('-').map(Number)

  copying.value = true
  try {
    const res = await copyBudget({
      from_year: fromYear,
      from_month: fromMonth,
      to_year: toYear,
      to_month: toMonth
    })
    
    if (res.code === 200) {
      ElMessage.success(`成功复制${res.data.copied}条预算`)
      copyVisible.value = false
      fetchData()
    }
  } finally {
    copying.value = false
  }
}

onMounted(() => {
  fetchCategories()
  fetchData()
})
</script>

<style scoped>
.budget-page {
  padding: 0;
}

.header-card {
  margin-bottom: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.summary-row {
  margin-bottom: 20px;
}

.summary-item {
  text-align: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.summary-value.expense {
  color: #f56c6c;
}

.summary-value.negative {
  color: #f56c6c;
}

.list-card {
  margin-bottom: 20px;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
}

.empty-state {
  padding: 40px 0;
  text-align: center;
}

.budget-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.budget-item {
  padding: 16px 20px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  transition: all 0.3s;
}

.budget-item:hover {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.08);
}

.budget-item.warning {
  border-color: #faecd8;
  background: linear-gradient(to right, #fdf6ec, #fff);
}

.budget-item.exceed {
  border-color: #fde2e2;
  background: linear-gradient(to right, #fef0f0, #fff);
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-icon {
  font-size: 20px;
}

.item-name {
  font-size: 15px;
  font-weight: 500;
  color: #303133;
}

.item-right {
  display: flex;
  gap: 4px;
}

.item-progress {
  margin-bottom: 12px;
}

.item-footer {
  display: flex;
  justify-content: space-between;
}

.stat {
  text-align: center;
  flex: 1;
}

.stat .label {
  font-size: 12px;
  color: #909399;
  display: block;
  margin-bottom: 4px;
}

.stat .value {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.stat .value.expense {
  color: #f56c6c;
}

.stat .value.negative {
  color: #f56c6c;
}
</style>
