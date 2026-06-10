import { get, post, put, del } from '@/utils/request'

export function getAssets(params) {
  return get('/assets', params)
}

export function getAsset(id) {
  return get(`/assets/${id}`)
}

export function createAsset(data) {
  return post('/assets', data)
}

export function updateAsset(id, data) {
  return put(`/assets/${id}`, data)
}

export function deleteAsset(id) {
  return del(`/assets/${id}`)
}

export function lockAsset(id) {
  return post(`/assets/${id}/lock`)
}

export function unlockAsset(id) {
  return post(`/assets/${id}/unlock`)
}

export function getAssetStats() {
  return get('/assets/stats')
}
