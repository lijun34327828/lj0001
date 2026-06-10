<template>
  <div class="dashboard">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card income-card">
          <div class="stat-icon">
            <el-icon size="32"><TrendCharts /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">总收入</p>
            <p class="stat-value money-income">¥{{ formatMoney(stats.current?.total_income) }}</p>
            <p class="stat-change" :class="stats.changes?.income?.is_up ? 'up' : 'down'">
              <el-icon><CaretTop v-if="stats.changes?.income?.is_up" /><CaretBottom v-else /></el-icon>
              {{ Math.abs(stats.changes?.income?.value || 0).toFixed(1) }}%
              <span>环比</span>
            </p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card expense-card">
          <div class="stat-icon expense-icon">
            <el-icon size="32"><ShoppingCart /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">总支出</p>
            <p class="stat-value money-expense">¥{{ formatMoney(stats.current?.total_expense) }}</p>
            <p class="stat-change" :class="stats.changes?.expense?.is_up ? 'down' : 'up'">
              <el-icon><CaretTop v-if="stats.changes?.expense?.is_up" /><CaretBottom v-else /></el-icon>
              {{ Math.abs(stats.changes?.expense?.value || 0).toFixed(1) }}%
              <span>环比</span>
            </p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card balance-card">
          <div class="stat-icon balance-icon">
            <el-icon size="32"><Wallet /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">结余</p>
            <p class="stat-value">¥{{ formatMoney(stats.current?.net_balance) }}</p>
            <p class="stat-change" :class="stats.changes?.balance?.is_up ? 'up' : 'down'">
              <el-icon><CaretTop v-if="stats.changes?.balance?.is_up" /><CaretBottom v-else /></el-icon>
              {{ Math.abs(stats.changes?.balance?.value || 0).toFixed(1) }}%
              <span>环比</span>
            </p>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card assets-card">
          <div class="stat-icon assets-icon">
            <el-icon size="32"><Coin /></el-icon>
          </div>
          <div class="stat-info">
            <p class="stat-label">总资产</p>
            <p class="stat-value text-primary">¥{{ formatMoney(stats.total_assets) }}</p>
            <p class="stat-change">
              <span>共 {{ stats.accounts?.length || 0 }} 个账户</span>
            </p>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">收支趋势</span>
              <el-radio-group v-model="trendType" size="small" @change="fetchTrendData">
                <el-radio-button value="month">月度</el-radio-button>
                <el-radio-button value="week">周度</el-radio-button>
                <el-radio-button value="day">日度</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">支出分类占比</span>
          </template>
          <div ref="pieChartRef" class="chart pie-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt-20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">预算预警</span>
              <el-button type="primary" link @click="$router.push('/budgets')">查看全部</el-button>
            </div>
          </template>
          <div v-if="budgetWarnings.length === 0" class="no-warning">
            <el-icon size="40" color="#67c23a"><CircleCheck /></el-icon>
            <p>本月预算使用正常</p>
          </div>
          <div v-else class="budget-warn-list">
            <div 
              v-for="item in budgetWarnings.slice(0, 5)" 
              :key="item.category_id" 
              class="budget-warn-item"
              :class="{ exceed: item.level === 'exceed' }"
            >
              <div class="item-head">
                <span class="item-icon">{{ item.category_icon || '📊' }}</span>
                <span class="item-name">{{ item.category_name }}</span>
                <span class="item-tag" :class="item.level">
                  {{ item.level === 'exceed' ? '已超支' : '预警' }}
                </span>
              </div>
              <el-progress 
                :percentage="Math.min(item.ratio * 100, 100)" 
                :status="item.level === 'exceed' ? 'exception' : 'warning'"
                :stroke-width="6"
              />
              <div class="item-foot">
                <span>已用 ¥{{ formatMoney(item.spent) }}</span>
                <span>预算 ¥{{ formatMoney(item.budget) }}</span>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <span class="card-title">最近账单</span>
              <el-button type="primary" link @click="$router.push('/bills')">查看全部</el-button>
            </div>
          </template>
          <div v-if="recentBills.length === 0" class="empty-bills">
            <el-empty description="暂无账单记录" :image-size="80" />
          </div>
          <div v-else class="recent-bills">
            <div 
              v-for="bill in recentBills" 
              :key="bill.id" 
              class="bill-item"
            >
              <div class="bill-icon" :class="bill.type">
                {{ bill.category_icon || (bill.type === 'income' ? '💰' : '💸') }}
              </div>
              <div class="bill-info">
                <p class="bill-title">{{ bill.category_name }}</p>
                <p class="bill-desc">{{ bill.description || '无描述' }}</p>
              </div>
              <div class="bill-amount" :class="bill.type">
                {{ bill.type === 'income' ? '+' : '-' }}¥{{ formatMoney(bill.amount) }}
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import * as echarts from 'echarts'
import { getOverviewStats, getTrendData, getCategoryStats } from '@/api/stats'
import { getBudgetOverview } from '@/api/budget'
import { getBills } from '@/api/bill'
import { formatMoney } from '@/utils'

const stats = ref({})
const budgetWarnings = ref([])
const recentBills = ref([])
const trendType = ref('month')
const trendChartRef = ref(null)
const pieChartRef = ref(null)
let trendChart = null
let pieChart = null

async function fetchOverview() {
  try {
    const res = await getOverviewStats()
    if (res.code === 200) {
      stats.value = res.data
    }
  } catch (e) {}
}

async function fetchBudgetWarnings() {
  try {
    const res = await getBudgetOverview()
    if (res.code === 200) {
      budgetWarnings.value = res.data.warnings || []
    }
  } catch (e) {}
}

async function fetchRecentBills() {
  try {
    const res = await getBills({ page: 1, pageSize: 8, sortBy: 'bill_time', sortOrder: 'desc' })
    if (res.code === 200) {
      recentBills.value = res.data.list || []
    }
  } catch (e) {}
}

async function fetchTrendData() {
  try {
    const ranges = { day: 30, week: 12, month: 12 }
    const res = await getTrendData({ type: trendType.value, range: ranges[trendType.value] })
    if (res.code === 200) {
      renderTrendChart(res.data.data)
    }
  } catch (e) {}
}

async function fetchPieData() {
  try {
    const res = await getCategoryStats({ type: 'expense' })
    if (res.code === 200) {
      renderPieChart(res.data.categories || [])
    }
  } catch (e) {}
}

function renderTrendChart(data) {
  if (!trendChart || !data) return
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1,
      textStyle: { color: '#303133' }
    },
    legend: {
      data: ['收入', '支出', '结余'],
      bottom: 0
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '10%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisLabel: { color: '#909399' }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5' } },
      axisLabel: { color: '#909399' }
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: data.map(d => d.income),
        itemStyle: { color: '#67c23a' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(103, 194, 58, 0.3)' },
            { offset: 1, color: 'rgba(103, 194, 58, 0.05)' }
          ])
        }
      },
      {
        name: '支出',
        type: 'line',
        smooth: true,
        data: data.map(d => d.expense),
        itemStyle: { color: '#f56c6c' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(245, 108, 108, 0.3)' },
            { offset: 1, color: 'rgba(245, 108, 108, 0.05)' }
          ])
        }
      },
      {
        name: '结余',
        type: 'line',
        smooth: true,
        data: data.map(d => d.balance),
        itemStyle: { color: '#409eff' }
      }
    ]
  }
  
  trendChart.setOption(option)
}

function renderPieChart(data) {
  if (!pieChart || !data.length) return
  
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9b59b6', '#1abc9c', '#34495e', '#e91e63', '#00bcd4']
  
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1,
      textStyle: { color: '#303133' },
      formatter: '{b}: ¥{c} ({d}%)'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: data.slice(0, 8).map((item, index) => ({
          value: item.total,
          name: item.name,
          itemStyle: { color: colors[index % colors.length] }
        }))
      }
    ]
  }
  
  pieChart.setOption(option)
}

function initCharts() {
  if (trendChartRef.value) {
    trendChart = echarts.init(trendChartRef.value)
  }
  if (pieChartRef.value) {
    pieChart = echarts.init(pieChartRef.value)
  }
}

function handleResize() {
  trendChart?.resize()
  pieChart?.resize()
}

onMounted(async () => {
  await nextTick()
  initCharts()
  
  await Promise.all([
    fetchOverview(),
    fetchBudgetWarnings(),
    fetchRecentBills(),
    fetchTrendData(),
    fetchPieData()
  ])
  
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.expense-icon {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
}

.balance-icon {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
}

.assets-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
}

.stat-info {
  flex: 1;
}

.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.money-income {
  color: #67c23a;
}

.money-expense {
  color: #f56c6c;
}

.stat-change {
  font-size: 12px;
  color: #909399;
  display: flex;
  align-items: center;
  gap: 2px;
}

.stat-change.up {
  color: #67c23a;
}

.stat-change.down {
  color: #f56c6c;
}

.stat-change span {
  color: #909399;
  margin-left: 4px;
}

.chart-card {
  height: 360px;
}

.chart {
  width: 100%;
  height: 300px;
}

.pie-chart {
  height: 280px;
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

.no-warning {
  text-align: center;
  padding: 30px 0;
  color: #909399;
}

.no-warning p {
  margin-top: 10px;
  font-size: 14px;
}

.budget-warn-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.budget-warn-item {
  padding: 12px;
  background: #fdf6ec;
  border-radius: 8px;
  border-left: 3px solid #e6a23c;
}

.budget-warn-item.exceed {
  background: #fef0f0;
  border-left-color: #f56c6c;
}

.item-head {
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

.item-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
}

.item-tag.warning {
  color: #e6a23c;
  background: #fff;
}

.item-tag.exceed {
  color: #f56c6c;
  background: #fff;
}

.item-foot {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.empty-bills {
  padding: 20px 0;
}

.recent-bills {
  display: flex;
  flex-direction: column;
}

.bill-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f5;
}

.bill-item:last-child {
  border-bottom: none;
}

.bill-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: #ecf5ff;
  margin-right: 12px;
}

.bill-icon.income {
  background: #f0f9eb;
}

.bill-icon.expense {
  background: #fef0f0;
}

.bill-info {
  flex: 1;
  min-width: 0;
}

.bill-title {
  font-size: 14px;
  color: #303133;
  margin-bottom: 2px;
}

.bill-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bill-amount {
  font-size: 15px;
  font-weight: 600;
}

.bill-amount.income {
  color: #67c23a;
}

.bill-amount.expense {
  color: #f56c6c;
}

.mt-20 {
  margin-top: 20px;
}
</style>
