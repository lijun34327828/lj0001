<template>
  <div class="category-page">
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">支出分类</span>
              <el-button type="primary" size="small" :icon="Plus" @click="openAddDialog('expense')">
                添加
              </el-button>
            </div>
          </template>
          
          <el-tree
            :data="expenseCategories"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            default-expand-all
          >
            <template #default="{ node, data }">
              <div class="tree-node">
                <span class="node-icon">{{ data.icon || '📁' }}</span>
                <span class="node-name">{{ data.name }}</span>
                <span class="node-actions">
                  <el-button 
                    type="primary" 
                    link 
                    size="small" 
                    @click.stop="openAddDialog('expense', data)"
                  >
                    添加子级
                  </el-button>
                  <el-button 
                    type="primary" 
                    link 
                    size="small"
                    @click.stop="openEditDialog(data)"
                  >
                    编辑
                  </el-button>
                  <el-button 
                    type="danger" 
                    link 
                    size="small"
                    @click.stop="handleDelete(data)"
                  >
                    删除
                  </el-button>
                </span>
              </div>
            </template>
          </el-tree>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">收入分类</span>
              <el-button type="success" size="small" :icon="Plus" @click="openAddDialog('income')">
                添加
              </el-button>
            </div>
          </template>
          
          <el-tree
            :data="incomeCategories"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            default-expand-all
          >
            <template #default="{ node, data }">
              <div class="tree-node">
                <span class="node-icon">{{ data.icon || '📁' }}</span>
                <span class="node-name">{{ data.name }}</span>
                <span class="node-actions">
                  <el-button 
                    type="success" 
                    link 
                    size="small"
                    @click.stop="openAddDialog('income', data)"
                  >
                    添加子级
                  </el-button>
                  <el-button 
                    type="primary" 
                    link 
                    size="small"
                    @click.stop="openEditDialog(data)"
                  >
                    编辑
                  </el-button>
                  <el-button 
                    type="danger" 
                    link 
                    size="small"
                    @click.stop="handleDelete(data)"
                  >
                    删除
                  </el-button>
                </span>
              </div>
            </template>
          </el-tree>
        </el-card>
      </el-col>
    </el-row>

    <el-dialog
      v-model="formVisible"
      :title="isEdit ? '编辑分类' : '新增分类'"
      width="400px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="分类名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入分类名称" maxlength="30" show-word-limit />
        </el-form-item>
        <el-form-item label="图标">
          <el-input v-model="form.icon" placeholder="emoji图标，如 🍜" maxlength="10" />
        </el-form-item>
        <el-form-item v-if="!isEdit && !parentCategory" label="分类类型">
          <el-radio-group v-model="form.type">
            <el-radio value="expense">支出</el-radio>
            <el-radio value="income">收入</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="parentCategory" label="父级分类">
          <span>{{ parentCategory.name }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/category'

const expenseCategories = ref([])
const incomeCategories = ref([])
const formVisible = ref(false)
const formRef = ref(null)
const isEdit = ref(false)
const editId = ref(null)
const parentCategory = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  type: 'expense',
  parent_id: 0,
  icon: ''
})

const rules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { min: 1, max: 30, message: '长度1-30个字符', trigger: 'blur' }
  ]
}

async function fetchCategories() {
  try {
    const res = await getCategories()
    if (res.code === 200) {
      const all = res.data || []
      expenseCategories.value = all.filter(c => c.type === 'expense')
      incomeCategories.value = all.filter(c => c.type === 'income')
    }
  } catch (e) {}
}

function openAddDialog(type, parent = null) {
  isEdit.value = false
  editId.value = null
  parentCategory.value = parent
  form.name = ''
  form.type = type
  form.parent_id = parent?.id || 0
  form.icon = ''
  formVisible.value = true
  
  setTimeout(() => {
    formRef.value?.clearValidate()
  }, 100)
}

function openEditDialog(category) {
  isEdit.value = true
  editId.value = category.id
  parentCategory.value = null
  form.name = category.name
  form.type = category.type
  form.parent_id = category.parent_id || 0
  form.icon = category.icon || ''
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
    let res
    if (isEdit.value) {
      res = await updateCategory(editId.value, form)
    } else {
      res = await createCategory(form)
    }

    if (res.code === 200) {
      ElMessage.success(isEdit.value ? '修改成功' : '创建成功')
      formVisible.value = false
      fetchCategories()
    }
  } finally {
    submitting.value = false
  }
}

async function handleDelete(category) {
  try {
    await ElMessageBox.confirm(
      `确定要删除分类「${category.name}」吗？`,
      '确认删除',
      { type: 'warning' }
    )
    
    const res = await deleteCategory(category.id)
    if (res.code === 200) {
      ElMessage.success('删除成功')
      fetchCategories()
    }
  } catch {
    // 取消删除
  }
}

onMounted(() => {
  fetchCategories()
})
</script>

<style scoped>
.category-page {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
}

.tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 0;
}

.node-icon {
  font-size: 16px;
}

.node-name {
  flex: 1;
  font-size: 14px;
}

.node-actions {
  display: none;
}

.tree-node:hover .node-actions {
  display: flex;
  gap: 4px;
}
</style>
