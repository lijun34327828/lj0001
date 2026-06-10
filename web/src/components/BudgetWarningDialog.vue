<template>
  <el-dialog
    v-model="visible"
    title="预算预警提醒"
    width="420px"
    :close-on-click-modal="false"
    :show-close="showClose"
    class="budget-warning-dialog"
  >
    <div class="dialog-content">
      <div class="warning-icon">
        <el-icon :size="56" :color="currentWarning?.level === 'exceed' ? '#f56c6c' : '#e6a23c'">
          <Warning />
        </el-icon>
      </div>
      
      <h3 class="warning-title">
        {{ currentWarning?.level === 'exceed' ? '预算已超支' : '预算即将超支' }}
      </h3>
      
      <p class="warning-message">{{ currentWarning?.message }}</p>
      
      <div class="budget-info">
        <div class="info-item">
          <span class="label">分类</span>
          <span class="value">{{ currentWarning?.category_name }}</span>
        </div>
        <div class="info-item">
          <span class="label">预算金额</span>
          <span class="value">¥{{ formatMoney(currentWarning?.budget) }}</span>
        </div>
        <div class="info-item">
          <span class="label">已支出</span>
          <span class="value expense">¥{{ formatMoney(currentWarning?.spent) }}</span>
        </div>
        <div class="info-item">
          <span class="label">剩余预算</span>
          <span class="value" :class="{ negative: Number(currentWarning?.remaining) < 0 }">
            ¥{{ formatMoney(currentWarning?.remaining) }}
          </span>
        </div>
      </div>

      <el-progress 
        :percentage="Math.min((currentWarning?.ratio || 0) * 100, 100)" 
        :status="currentWarning?.level === 'exceed' ? 'exception' : 'warning'"
        :stroke-width="8"
      />
    </div>

    <template #footer>
      <el-button v-if="showClose" @click="handleClose">知道了</el-button>
      <el-button v-if="canContinue" type="primary" @click="handleConfirm">
        {{ confirmText || '确认提交' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Warning } from '@element-plus/icons-vue'
import { formatMoney } from '@/utils'

const visible = ref(false)
const currentWarning = ref(null)
const showClose = ref(true)
const canContinue = ref(false)
const confirmText = ref('')
let resolvePromise = null

function showWarning(warning, options = {}) {
  currentWarning.value = warning
  showClose.value = options.showClose !== false
  canContinue.value = options.canContinue || false
  confirmText.value = options.confirmText || ''
  
  visible.value = true
  
  return new Promise(resolve => {
    resolvePromise = resolve
  })
}

function handleClose() {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(false)
    resolvePromise = null
  }
}

function handleConfirm() {
  visible.value = false
  if (resolvePromise) {
    resolvePromise(true)
    resolvePromise = null
  }
}

defineExpose({
  showWarning
})
</script>

<style scoped>
.dialog-content {
  text-align: center;
  padding: 10px 0 20px;
}

.warning-icon {
  margin-bottom: 16px;
}

.warning-title {
  font-size: 18px;
  color: #303133;
  margin-bottom: 8px;
}

.warning-message {
  color: #606266;
  margin-bottom: 20px;
  font-size: 14px;
}

.budget-info {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.info-item .label {
  color: #909399;
}

.info-item .value {
  color: #303133;
  font-weight: 500;
}

.info-item .value.expense {
  color: #f56c6c;
}

.info-item .value.negative {
  color: #f56c6c;
}
</style>
