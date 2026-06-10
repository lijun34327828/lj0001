<template>
  <el-popover
    placement="bottom"
    width="320"
    trigger="click"
    popper-class="budget-warn-popover"
  >
    <template #reference>
      <el-badge :value="warningCount" :hidden="warningCount === 0" class="warn-badge">
        <el-button type="warning" text circle :icon="Bell" size="large" />
      </el-badge>
    </template>

    <div class="warn-content">
      <div class="warn-header">
        <span class="warn-title">预算预警</span>
        <span class="warn-count">{{ warningCount }} 项提醒</span>
      </div>
      
      <div v-if="warningCount === 0" class="no-warning">
        <el-icon size="48" color="#67c23a"><CircleCheck /></el-icon>
        <p>本月预算使用正常</p>
      </div>

      <div v-else class="warn-list">
        <div 
          v-for="item in warnings" 
          :key="item.category_id" 
          class="warn-item"
          :class="{ exceed: item.level === 'exceed' }"
        >
          <div class="item-header">
            <span class="item-icon">{{ item.category_icon || '📊' }}</span>
            <span class="item-name">{{ item.category_name }}</span>
            <span class="item-badge" :class="item.level">
              {{ item.level === 'exceed' ? '已超支' : '预警' }}
            </span>
          </div>
          <div class="item-progress">
            <el-progress 
              :percentage="Math.min(item.ratio * 100, 100)" 
              :status="item.level === 'exceed' ? 'exception' : 'warning'"
              :stroke-width="6"
              :show-text="false"
            />
          </div>
          <div class="item-footer">
            <span>已用 ¥{{ formatMoney(item.spent) }}</span>
            <span>预算 ¥{{ formatMoney(item.budget) }}</span>
          </div>
        </div>
      </div>

      <div class="warn-footer" @click="goToBudget">
        <span>查看全部预算</span>
        <el-icon><ArrowRight /></el-icon>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Bell, ArrowRight, CircleCheck } from '@element-plus/icons-vue'
import { getBudgetOverview } from '@/api/budget'
import { formatMoney } from '@/utils'

const router = useRouter()
const warningCount = ref(0)
const warnings = ref([])
let timer = null

async function fetchWarnings() {
  try {
    const res = await getBudgetOverview()
    if (res.code === 200) {
      warnings.value = res.data.warnings || []
      warningCount.value = res.data.warningCount || 0
    }
  } catch (e) {}
}

function goToBudget() {
  router.push('/budgets')
}

onMounted(() => {
  fetchWarnings()
  timer = setInterval(fetchWarnings, 60000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

defineExpose({
  refresh: fetchWarnings
})
</script>

<style scoped>
.warn-badge :deep(.el-badge__content) {
  transform: translateX(0) translateY(0);
}

.warn-content {
  padding: 0;
}

.warn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.warn-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
}

.warn-count {
  font-size: 12px;
  color: #e6a23c;
  background: #fdf6ec;
  padding: 2px 8px;
  border-radius: 10px;
}

.no-warning {
  padding: 40px 20px;
  text-align: center;
  color: #909399;
}

.no-warning p {
  margin-top: 12px;
  font-size: 14px;
}

.warn-list {
  max-height: 300px;
  overflow-y: auto;
  padding: 8px 0;
}

.warn-item {
  padding: 12px 16px;
  cursor: pointer;
}

.warn-item:hover {
  background: #f5f7fa;
}

.warn-item.exceed .item-name {
  color: #f56c6c;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.item-icon {
  font-size: 16px;
}

.item-name {
  flex: 1;
  font-size: 14px;
  color: #303133;
}

.item-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
}

.item-badge.warning {
  color: #e6a23c;
  background: #fdf6ec;
}

.item-badge.exceed {
  color: #f56c6c;
  background: #fef0f0;
}

.item-progress {
  margin-bottom: 6px;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
}

.warn-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  padding: 10px 16px;
  border-top: 1px solid #ebeef5;
  font-size: 13px;
  color: #409eff;
  cursor: pointer;
}

.warn-footer:hover {
  color: #66b1ff;
}
</style>

<style>
.budget-warn-popover {
  padding: 0 !important;
}
</style>
