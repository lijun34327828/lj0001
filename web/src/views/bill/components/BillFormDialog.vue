<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑账单' : '新增账单'"
    width="520px"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
    >
      <el-form-item label="类型" prop="type">
        <el-radio-group v-model="form.type" @change="handleTypeChange">
          <el-radio-button value="expense">支出</el-radio-button>
          <el-radio-button value="income">收入</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="金额" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0.01"
          :max="999999999.99"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 100%"
          size="large"
        />
      </el-form-item>

      <el-form-item label="账户" prop="account_id">
        <el-select v-model="form.account_id" placeholder="请选择账户" style="width: 100%">
          <el-option
            v-for="acc in accounts"
            :key="acc.id"
            :label="`${acc.name} (¥${formatMoney(acc.balance)})`"
            :value="acc.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="分类" prop="category_id">
        <el-cascader
          v-model="categoryValue"
          :options="filteredCategories"
          :props="{ value: 'id', label: 'name', children: 'children' }"
          placeholder="请选择分类"
          style="width: 100%"
          :show-all-levels="false"
          @change="handleCategoryChange"
        />
      </el-form-item>

      <el-form-item label="时间" prop="bill_time">
        <el-date-picker
          v-model="form.bill_time"
          type="datetime"
          placeholder="选择日期时间"
          style="width: 100%"
          :disabled-date="disabledDate"
        />
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="选填，账单备注信息"
        />
      </el-form-item>
    </el-form>

    <div v-if="budgetWarning" class="budget-warn-tip" :class="budgetWarning.level">
      <el-icon><Warning /></el-icon>
      <span>{{ budgetWarning.message }}</span>
    </div>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ isEdit ? '保存修改' : '确认添加' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { createBill, updateBill } from '@/api/bill'
import { checkCanAddExpense } from '@/api/budget'
import { formatMoney } from '@/utils'
import dayjs from 'dayjs'

const props = defineProps({
  accounts: { type: Array, default: () => [] },
  categoryTree: { type: Array, default: () => [] }
})

const emit = defineEmits(['success'])

const visible = ref(false)
const formRef = ref(null)
const submitting = ref(false)
const isEdit = ref(false)
const editId = ref(null)
const categoryValue = ref([])
const budgetWarning = ref(null)

const form = reactive({
  type: 'expense',
  amount: null,
  account_id: null,
  category_id: null,
  bill_time: null,
  description: ''
})

const rules = {
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
  amount: [
    { required: true, message: '请输入金额', trigger: 'blur' },
    { type: 'number', min: 0.01, message: '金额必须大于0', trigger: 'blur' }
  ],
  account_id: [{ required: true, message: '请选择账户', trigger: 'change' }],
  category_id: [{ required: true, message: '请选择分类', trigger: 'change' }],
  bill_time: [{ required: true, message: '请选择时间', trigger: 'change' }]
}

const filteredCategories = computed(() => {
  return props.categoryTree.filter(cat => cat.type === form.type)
})

const disabledDate = (time) => {
  return time.getTime() > Date.now() + 86400000
}

function handleTypeChange() {
  categoryValue.value = []
  form.category_id = null
  budgetWarning.value = null
}

function handleCategoryChange(val) {
  if (val && val.length > 0) {
    form.category_id = val[val.length - 1]
    if (form.type === 'expense' && form.amount) {
      checkBudget()
    }
  } else {
    form.category_id = null
  }
}

watch(() => form.amount, (newVal) => {
  if (form.type === 'expense' && form.category_id && newVal) {
    checkBudget()
  } else {
    budgetWarning.value = null
  }
})

async function checkBudget() {
  if (!form.category_id || !form.amount) {
    budgetWarning.value = null
    return
  }
  
  try {
    const res = await checkCanAddExpense({
      category_id: form.category_id,
      amount: form.amount
    })
    if (res.code === 200 && res.data.reason) {
      budgetWarning.value = {
        ...res.data,
        message: res.data.reason
      }
    } else {
      budgetWarning.value = null
    }
  } catch {
    budgetWarning.value = null
  }
}

function open(data = null) {
  isEdit.value = !!data
  editId.value = data?.id || null
  
  if (data) {
    form.type = data.type
    form.amount = Number(data.amount)
    form.account_id = data.account_id
    form.bill_time = data.bill_time
    form.description = data.description || ''
    
    const parentId = data.category_parent_id
    if (parentId && parentId !== 0) {
      categoryValue.value = [parentId, data.category_id]
    } else {
      categoryValue.value = [data.category_id]
    }
    form.category_id = data.category_id
  } else {
    form.type = 'expense'
    form.amount = null
    form.account_id = props.accounts[0]?.id || null
    form.bill_time = new Date()
    form.description = ''
    categoryValue.value = []
    form.category_id = null
  }
  
  budgetWarning.value = null
  visible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
}

function handleClose() {
  visible.value = false
  budgetWarning.value = null
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
    const data = {
      ...form,
      bill_time: dayjs(form.bill_time).format('YYYY-MM-DD HH:mm:ss')
    }

    let res
    if (isEdit.value) {
      res = await updateBill(editId.value, data)
    } else {
      res = await createBill(data)
    }

    if (res.code === 200) {
      ElMessage.success(isEdit.value ? '修改成功' : '添加成功')
      
      if (res.data?.budgetWarning?.level === 'exceed' || res.data?.budgetWarning?.level === 'warning') {
        setTimeout(() => {
          ElMessage.warning(res.data.budgetWarning.message)
        }, 500)
      }
      
      emit('success')
      handleClose()
    }
  } finally {
    submitting.value = false
  }
}

defineExpose({ open })
</script>

<style scoped>
.budget-warn-tip {
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.budget-warn-tip.warning {
  background: #fdf6ec;
  color: #e6a23c;
  border: 1px solid #faecd8;
}

.budget-warn-tip.exceed {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}
</style>
