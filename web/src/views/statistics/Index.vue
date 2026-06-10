<template>
  <div class="statistics-page">
    <el-card class="date-selector-card">
      <div class="selector-row">
        <div class="selector-item">
          <span class="label">时间维度</span>
          <el-radio-group v-model="timeType" size="small" @change="handleTimeTypeChange">
            <el-radio-button value="month">月度</el-radio-button>
            <el-radio-button value="year">年度</el-radio-button>
          </el-radio-group>
        </div>
        <div class="selector-item">
          <span class="label">选择时间</span>
          <el-date-picker
            v-if="timeType === 'month'"
            v-model="currentMonth"
            type="month"
            format="YYYY年MM月"
            value-format="YYYY-MM"
            size="small"
            @change="fetchAllData"
          />
          <el-date-picker
            v-else
            v-model="currentYear"
            type="year"
            format="YYYY年"
            value-format="YYYY"
            size="small"
            @change="fetchAllData"
          />
        </div>
      </div>
    </el-card>

    <el-row :gutter="20" class="summary-row">
      <el-col :span="6">
        <div class="summary-card income">
          <div class="card-icon">
            <el-icon><TrendCharts /></el-icon>
          </div>
          <div class="card-content">
            <p class="card-label">总收入</p>
            <p class="card-value">¥{{ formatMoney(incomeStats?.current) }}</p>
            <div class="card-change">
              <span class="mom">
                环比
                <span :class="momChange.income.is_up ? 'up' : 'down'">
                  {{ momChange.income.is_up ? '↑' : '↓' }}
                  {{ Math.abs(momChange.income.value).toFixed(1) }}%
                </span>
              </span>
              <span class="yoy">
                同比
                <span :class="yoyChange.income.is_up ? 'up' : 'down'">
                  {{ yoyChange.income.is_up ? '↑' : '↓' }}
                  {{ Math.abs(yoyChange.income.value).toFixed(1) }}%
                </span>
              </span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="summary-card expense">
          <div class="card-icon expense-icon">
            <el-icon><ShoppingCart /></el-icon>
          </div>
          <div class="card-content">
            <p class="card-label">总支出</p>
            <p class="card-value">¥{{ formatMoney(expenseStats?.current) }}</p>
            <div class="card-change">
              <span class="mom">
                环比
                <span :class="momChange.expense.is_up ? 'down' : 'up'">
                  {{ momChange.expense.is_up ? '↑' : '↓' }}
                  {{ Math.abs(momChange.expense.value).toFixed(1) }}%
                </span>
              </span>
              <span class="yoy">
                同比
                <span :class="yoyChange.expense.is_up ? 'down' : 'up'">
                  {{ yoyChange.expense.is_up ? '↑' : '↓' }}
                  {{ Math.abs(yoyChange.expense.value).toFixed(1) }}%
                </span>
              </span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="summary-card balance">
          <div class="card-icon balance-icon">
            <el-icon><Wallet /></el-icon>
          </div>
          <div class="card-content">
            <p class="card-label">结余</p>
            <p class="card-value">¥{{ formatMoney(netBalance) }}</p>
            <div class="card-change">
              <span class="mom">
                环比
                <span :class="momChange.balance.is_up ? 'up' : 'down'">
                  {{ momChange.balance.is_up ? '↑' : '↓' }}
                  {{ Math.abs(momChange.balance.value).toFixed(1) }}%
                </span>
              </span>
              <span class="yoy">
                同比
                <span :class="yoyChange.balance.is_up ? 'up' : 'down'">
                  {{ yoyChange.balance.is_up ? '↑' : '↓' }}
                  {{ Math.abs(yoyChange.balance.value).toFixed(1) }}%
                </span>
              </span>
            </div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="summary-card count">
          <div class="card-icon count-icon">
            <el-icon><Document /></el-icon>
          </div>
          <div class="card-content">
            <p class="card-label">账单笔数</p>
            <p class="card-value">{{ billCount }} 笔</p>
            <p class="card-sub">平均单笔 ¥{{ formatMoney(avgAmount) }}</p>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="16">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">收支趋势</span>
          </template>
          <div ref="trendChartRef" class="chart-large"></div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card class="chart-card">
          <template #header>
            <div class="card-header">
              <span class="card-title">支出分类排行</span>
              <el-radio-group v-model="rankType" size="small" @change="fetchCategoryStats">
                <el-radio-button value="expense">支出</el-radio-button>
                <el-radio-button value="income">收入</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="barChartRef" class="chart-medium"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="chart-row">
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">支出构成</span>
          </template>
          <div ref="pieChartRef" class="chart-medium"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card class="chart-card">
          <template #header>
            <span class="card-title">资产趋势</span>
          </template>
          <div ref="assetChartRef" class="chart-medium"></div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="detail-card">
      <template #header>
        <span class="card-title">分类明细</span>
      </template>
      <el-tabs v-model="detailTab" @tab-change="fetchCategoryStats">
        <el-tab-pane label="支出" name="expense" />
        <el-tab-pane label="收入" name="income" />
      </el-tabs>
      
      <el-table :data="categoryList" v-loading="categoryLoading">
        <el-table-column prop="name" label="分类" width="180">
          <template #default="{ row }">
            <span class="cat-cell">
              {{ row.icon || '📊' }} {{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="笔数" width="100" align="right" />
        <el-table-column label="金额" width="140" align="right">
          <template #default="{ row }">
            ¥{{ formatMoney(row.total) }}
          </template>
        </el-table-column>
        <el-table-column label="占比" width="200">
          <template #default="{ row }">
            <div class="ratio-cell">
              <el-progress 
                :percentage="row.ratio * 100" 
                :stroke-width="8"
                :show-text="false"
                style="flex: 1; margin-right: 10px"
              />
              <span class="ratio-text">{{ (row.ratio * 100).toFixed(1) }}%</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="同比" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.yoy?.is_up ? 'text-success' : 'text-danger'">
              {{ row.yoy?.is_up ? '+' : '' }}{{ row.yoy?.value?.toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
        <el-table-column label="环比" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.mom?.is_up ? 'text-success' : 'text-danger'">
              {{ row.mom?.is_up ? '+' : '' }}{{ row.mom?.value?.toFixed(1) }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, computed, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { getTrendData, getCategoryStats, getAssetTrend, getMonthlyReport } from '@/api/stats'
import { formatMoney } from '@/utils'

const timeType = ref('month')
const currentMonth = ref(dayjs().format('YYYY-MM'))
const currentYear = ref(String(dayjs().year()))
const rankType = ref('expense')
const detailTab = ref('expense')
const categoryLoading = ref(false)

const trendChartRef = ref(null)
const barChartRef = ref(null)
const pieChartRef = ref(null)
const assetChartRef = ref(null)

let trendChart = null
let barChart = null
let pieChart = null
let assetChart = null

const incomeStats = ref({ current: 0, previous: 0 })
const expenseStats = ref({ current: 0, previous: 0 })
const billCount = ref(0)
const categoryList = ref([])

const netBalance = computed(() => incomeStats.value.current - expenseStats.value.current)
const avgAmount = computed(() => billCount.value > 0 ? (expenseStats.value.current / billCount.value) : 0)

const prevPeriod = computed(() => {
  if (timeType.value === 'month') {
    return dayjs(currentMonth.value).subtract(1, 'month').format('YYYY-MM')
  }
  return String(Number(currentYear.value) - 1)
})

const yoyPeriod = computed(() => {
  if (timeType.value === 'month') {
    return dayjs(currentMonth.value).subtract(1, 'year').format('YYYY-MM')
  }
  return String(Number(currentYear.value) - 1)
})

const momChange = reactive({
  income: { value: 0, is_up: true },
  expense: { value: 0, is_up: true },
  balance: { value: 0, is_up: true }
})

const yoyChange = reactive({
  income: { value: 0, is_up: true },
  expense: { value: 0, is_up: true },
  balance: { value: 0, is_up: true }
})

function calcChange(current, previous) {
  if (previous === 0) {
    return { value: current > 0 ? 100 : 0, is_up: current >= 0, is_infinite: previous === 0 }
  }
  const change = ((current - previous) / Math.abs(previous)) * 100
  return { value: Math.round(change * 100) / 100, is_up: change >= 0 }
}

function handleTimeTypeChange() {
  fetchAllData()
}

async function fetchAllData() {
  await Promise.all([
    fetchTrendData(),
    fetchCategoryStats(),
    fetchAssetTrendData(),
    fetchSummaryData()
  ])
}

async function fetchSummaryData() {
  try {
    let year, month
    if (timeType.value === 'month') {
      [year, month] = currentMonth.value.split('-').map(Number)
    } else {
      year = Number(currentYear.value)
      month = null
    }

    const res = await getMonthlyReport({ year, month })
    if (res.code === 200) {
      const data = res.data
      incomeStats.value.current = data.summary.total_income || 0
      expenseStats.value.current = data.summary.total_expense || 0
      billCount.value = data.summary.bill_count || 0

      momChange.income = calcChange(data.summary.total_income, data.mom.prev_income)
      momChange.expense = calcChange(data.summary.total_expense, data.mom.prev_expense)
      momChange.balance = calcChange(
        data.summary.total_income - data.summary.total_expense,
        data.mom.prev_income - data.mom.prev_expense
      )

      yoyChange.income = calcChange(data.summary.total_income, data.yoy.prev_income)
      yoyChange.expense = calcChange(data.summary.total_expense, data.yoy.prev_expense)
      yoyChange.balance = calcChange(
        data.summary.total_income - data.summary.total_expense,
        data.yoy.prev_income - data.yoy.prev_expense
      )
    }
  } catch (e) {}
}

async function fetchTrendData() {
  try {
    const ranges = { month: 12, year: 5 }
    const res = await getTrendData({ 
      type: timeType.value, 
      range: ranges[timeType.value] 
    })
    if (res.code === 200) {
      renderTrendChart(res.data.data)
    }
  } catch (e) {}
}

async function fetchCategoryStats() {
  categoryLoading.value = true
  try {
    let year, month
    if (timeType.value === 'month') {
      [year, month] = currentMonth.value.split('-').map(Number)
    } else {
      year = Number(currentYear.value)
      month = null
    }

    const type = rankType.value
    const res = await getCategoryStats({ type, year, month })
    if (res.code === 200) {
      const categories = res.data.categories || []
      categoryList.value = categories.map(cat => ({
        ...cat,
        yoy: res.data.yoy ? calcChange(cat.total, res.data.yoy.previous) : { value: 0, is_up: true },
        mom: { value: 0, is_up: true }
      }))

      renderBarChart(categories)
      renderPieChart(categories)
    }
  } finally {
    categoryLoading.value = false
  }
}

async function fetchAssetTrendData() {
  try {
    const months = timeType.value === 'month' ? 12 : 36
    const res = await getAssetTrend({ months })
    if (res.code === 200) {
      renderAssetChart(res.data.data)
    }
  } catch (e) {}
}

function renderTrendChart(data) {
  if (!trendChart || !data?.length) return
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1
    },
    legend: {
      data: ['收入', '支出', '结余'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: '#e4e7ed' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5' } }
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
        itemStyle: { color: '#409eff' },
        lineStyle: { type: 'dashed' }
      }
    ]
  }
  
  trendChart.setOption(option)
}

function renderBarChart(data) {
  if (!barChart || !data?.length) return
  
  const topData = data.slice(0, 10).reverse()
  const colors = ['#f56c6c', '#e6a23c', '#409eff', '#67c23a', '#909399', '#9b59b6', '#1abc9c', '#34495e', '#e91e63', '#00bcd4']
  
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '3%',
      top: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5' } }
    },
    yAxis: {
      type: 'category',
      data: topData.map(d => d.name),
      axisLine: { lineStyle: { color: '#e4e7ed' } },
      axisTick: { show: false }
    },
    series: [{
      type: 'bar',
      data: topData.map((d, i) => ({
        value: d.total,
        itemStyle: {
          color: colors[i % colors.length],
          borderRadius: [0, 4, 4, 0]
        }
      })),
      barWidth: 16,
      label: {
        show: true,
        position: 'right',
        formatter: '{c}'
      }
    }]
  }
  
  barChart.setOption(option)
}

function renderPieChart(data) {
  if (!pieChart || !data?.length) return
  
  const colors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#909399', '#9b59b6', '#1abc9c', '#34495e', '#e91e63', '#00bcd4']
  
  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1,
      formatter: '{b}: ¥{c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      itemWidth: 12,
      itemHeight: 12
    },
    series: [{
      type: 'pie',
      radius: ['45%', '70%'],
      center: ['38%', '50%'],
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
      data: data.slice(0, 10).map((item, index) => ({
        value: item.total,
        name: item.name,
        itemStyle: { color: colors[index % colors.length] }
      }))
    }]
  }
  
  pieChart.setOption(option)
}

function renderAssetChart(data) {
  if (!assetChart || !data?.length) return
  
  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e4e7ed',
      borderWidth: 1
    },
    legend: {
      data: ['现金资产', '资产价值', '总资产'],
      top: 10
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.map(d => d.label),
      axisLine: { lineStyle: { color: '#e4e7ed' } }
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f0f2f5' } }
    },
    series: [
      {
        name: '现金资产',
        type: 'line',
        stack: 'Total',
        areaStyle: { color: 'rgba(103, 194, 58, 0.3)' },
        data: data.map(d => d.cash_balance),
        itemStyle: { color: '#67c23a' }
      },
      {
        name: '资产价值',
        type: 'line',
        stack: 'Total',
        areaStyle: { color: 'rgba(230, 162, 60, 0.3)' },
        data: data.map(d => d.asset_value),
        itemStyle: { color: '#e6a23c' }
      },
      {
        name: '总资产',
        type: 'line',
        smooth: true,
        data: data.map(d => d.total_assets),
        itemStyle: { color: '#409eff' },
        lineStyle: { width: 2 }
      }
    ]
  }
  
  assetChart.setOption(option)
}

function initCharts() {
  if (trendChartRef.value) trendChart = echarts.init(trendChartRef.value)
  if (barChartRef.value) barChart = echarts.init(barChartRef.value)
  if (pieChartRef.value) pieChart = echarts.init(pieChartRef.value)
  if (assetChartRef.value) assetChart = echarts.init(assetChartRef.value)
}

function handleResize() {
  trendChart?.resize()
  barChart?.resize()
  pieChart?.resize()
  assetChart?.resize()
}

watch(detailTab, () => {
  rankType.value = detailTab.value
  fetchCategoryStats()
})

onMounted(async () => {
  await nextTick()
  initCharts()
  await fetchAllData()
  
  window.addEventListener('resize', handleResize)
})
</script>

<style scoped>
.statistics-page {
  padding: 0;
}

.date-selector-card {
  margin-bottom: 20px;
}

.selector-row {
  display: flex;
  gap: 30px;
}

.selector-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.selector-item .label {
  font-size: 14px;
  color: #606266;
}

.summary-row {
  margin-bottom: 20px;
}

.summary-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  gap: 16px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
}

.card-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
}

.expense-icon {
  background: linear-gradient(135deg, #f56c6c 0%, #f78989 100%);
}

.balance-icon {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
}

.count-icon {
  background: linear-gradient(135deg, #e6a23c 0%, #ebb563 100%);
}

.card-content {
  flex: 1;
}

.card-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.card-value {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.card-sub {
  font-size: 12px;
  color: #909399;
}

.card-change {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #909399;
}

.card-change .up {
  color: #67c23a;
}

.card-change .down {
  color: #f56c6c;
}

.chart-card {
  margin-bottom: 20px;
}

.chart-large {
  width: 100%;
  height: 320px;
}

.chart-medium {
  width: 100%;
  height: 280px;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-row {
  margin-bottom: 20px;
}

.detail-card {
  margin-bottom: 20px;
}

.ratio-cell {
  display: flex;
  align-items: center;
}

.ratio-text {
  font-size: 12px;
  color: #606266;
  width: 50px;
  text-align: right;
}

.cat-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}
</style>
