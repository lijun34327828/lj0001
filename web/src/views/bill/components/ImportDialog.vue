<template>
  <el-dialog
    v-model="visible"
    title="批量导入账单"
    width="600px"
    :close-on-click-modal="false"
  >
    <div class="import-dialog">
      <div class="import-tip">
        <el-alert
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>
            <span>请上传CSV格式的账单文件，支持分账户导入</span>
            <el-button type="primary" link @click="downloadTemplate">下载模板</el-button>
          </template>
        </el-alert>
      </div>

      <el-form label-width="100px">
        <el-form-item label="导入账户" required>
          <el-select v-model="accountId" placeholder="请选择导入账户" style="width: 100%">
            <el-option
              v-for="acc in accounts"
              :key="acc.id"
              :label="acc.name"
              :value="acc.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择文件" required>
          <el-upload
            ref="uploadRef"
            drag
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :limit="1"
            accept=".csv"
            :file-list="fileList"
            :on-exceed="handleExceed"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将CSV文件拖到此处，或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">仅支持CSV格式文件，最大10MB</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <div v-if="previewLoading" class="preview-section">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="previewData.length > 0" class="preview-section">
        <div class="preview-header">
          <span class="preview-title">数据预览（前10条）</span>
          <span class="preview-stats">
            成功 <span class="text-success">{{ validCount }}</span> 条，
            失败 <span class="text-danger">{{ errorCount }}</span> 条
          </span>
        </div>
        
        <div class="preview-table-wrap">
          <el-table :data="previewData.slice(0, 10)" size="small" border max-height="240">
            <el-table-column prop="row" label="行号" width="60" />
            <el-table-column prop="type" label="类型" width="80">
              <template #default="{ row }">
                <el-tag :type="row.type === 'income' ? 'success' : 'danger'" size="small">
                  {{ row.type === 'income' ? '收入' : '支出' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="category" label="分类" width="100" />
            <el-table-column prop="amount" label="金额" width="100" />
            <el-table-column prop="date" label="日期" width="160" />
            <el-table-column prop="description" label="备注" />
            <el-table-column prop="error" label="错误" width="120">
              <template #default="{ row }">
                <span v-if="row.error" class="error-text">{{ row.error }}</span>
                <span v-else class="success-text">✓</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button 
        type="primary" 
        :loading="importing"
        :disabled="!canImport"
        @click="handleImport"
      >
        确认导入
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { importBills, previewImport, downloadTemplate as downloadTemplateApi } from '@/api/bill'

const props = defineProps({
  accounts: { type: Array, default: () => [] }
})

const emit = defineEmits(['success'])

const visible = ref(false)
const fileList = ref([])
const uploadRef = ref(null)
const currentFile = ref(null)
const accountId = ref(null)
const importing = ref(false)
const previewLoading = ref(false)
const previewData = ref([])

const validCount = computed(() => previewData.value.filter(item => !item.error).length)
const errorCount = computed(() => previewData.value.filter(item => item.error).length)
const canImport = computed(() => accountId.value && currentFile.value && validCount.value > 0)

function open() {
  accountId.value = props.accounts[0]?.id || null
  fileList.value = []
  currentFile.value = null
  previewData.value = []
  visible.value = true
}

function handleFileChange(file) {
  if (!file.raw) {
    currentFile.value = null
    previewData.value = []
    return
  }
  
  if (!file.name.endsWith('.csv')) {
    ElMessage.error('请上传CSV格式的文件')
    fileList.value = []
    currentFile.value = null
    previewData.value = []
    return
  }
  
  if (file.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过10MB')
    fileList.value = []
    currentFile.value = null
    previewData.value = []
    return
  }

  currentFile.value = file.raw
  fileList.value = [file]
  
  doPreview()
}

function handleExceed() {
  ElMessage.warning('只能上传一个文件')
}

function normalizeType(type) {
  if (!type) return ''
  const t = String(type).toLowerCase()
  if (t === 'income' || t === '收入') return 'income'
  if (t === 'expense' || t === '支出') return 'expense'
  return type
}

async function doPreview() {
  if (!currentFile.value) return
  
  previewLoading.value = true
  previewData.value = []
  try {
    const res = await previewImport(currentFile.value)
    if (res.code === 200) {
      const previewItems = (res.data.preview || []).map(item => ({
        ...item,
        type: normalizeType(item.type),
        error: null
      }))
      const errorItems = (res.data.errors || []).map(item => ({
        ...item,
        type: normalizeType(item.type)
      }))
      previewData.value = [...previewItems, ...errorItems].sort((a, b) => a.row - b.row)
    } else {
      ElMessage.error(res.message || '预览失败')
      previewData.value = []
    }
  } catch (e) {
    ElMessage.error(e.message || '预览失败，请检查文件格式')
    previewData.value = []
  } finally {
    previewLoading.value = false
  }
}

async function handleImport() {
  if (!canImport.value) return
  
  importing.value = true
  try {
    const res = await importBills(currentFile.value, accountId.value)
    if (res.code === 200) {
      ElMessage.success(`导入完成，成功${res.data.success}条，失败${res.data.failed}条`)
      emit('success')
      visible.value = false
    } else {
      ElMessage.error(res.message || '导入失败')
    }
  } catch (e) {
    ElMessage.error(e.message || '导入失败，请重试')
  } finally {
    importing.value = false
  }
}

async function downloadTemplate() {
  try {
    const a = document.createElement('a')
    a.href = '/api/bills/export/template'
    a.download = 'bill_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    ElMessage.success('模板下载中...')
  } catch (e) {
    ElMessage.error('模板下载失败')
  }
}

defineExpose({ open })
</script>

<style scoped>
.import-dialog {
  padding: 10px 0;
}

.import-tip {
  margin-bottom: 20px;
}

.preview-section {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 20px;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.preview-title {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
}

.preview-stats {
  font-size: 13px;
  color: #606266;
}

.preview-table-wrap {
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.error-text {
  color: #f56c6c;
  font-size: 12px;
}

.success-text {
  color: #67c23a;
}

.text-success {
  color: #67c23a;
  font-weight: 500;
}

.text-danger {
  color: #f56c6c;
  font-weight: 500;
}
</style>
