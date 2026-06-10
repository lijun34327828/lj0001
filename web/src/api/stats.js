import { get } from '@/utils/request'

export function getOverviewStats(params) {
  return get('/stats/overview', params)
}

export function getCategoryStats(params) {
  return get('/stats/category', params)
}

export function getTrendData(params) {
  return get('/stats/trend', params)
}

export function getAssetTrend(params) {
  return get('/stats/asset-trend', params)
}

export function getMonthlyReport(params) {
  return get('/stats/monthly-report', params)
}
