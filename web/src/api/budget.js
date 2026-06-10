import { get, post, del } from '@/utils/request'

export function getBudgets(params) {
  return get('/budgets', params)
}

export function setBudget(data) {
  return post('/budgets', data)
}

export function deleteBudget(id) {
  return del(`/budgets/${id}`)
}

export function getBudgetOverview(params) {
  return get('/budgets/overview', params)
}

export function copyBudget(data) {
  return post('/budgets/copy', data)
}

export function checkCanAddExpense(params) {
  return get('/budgets/check', params)
}
