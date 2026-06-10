import { get, post, put, del } from '@/utils/request'

export function getAccounts() {
  return get('/accounts')
}

export function getAccount(id) {
  return get(`/accounts/${id}`)
}

export function createAccount(data) {
  return post('/accounts', data)
}

export function updateAccount(id, data) {
  return put(`/accounts/${id}`, data)
}

export function deleteAccount(id) {
  return del(`/accounts/${id}`)
}

export function setDefaultAccount(id) {
  return put(`/accounts/${id}/default`)
}

export function getAccountStats(accountId, params) {
  return get(`/accounts/${accountId}/stats`, params)
}
