import { get, post, put, del } from '@/utils/request'

export function getCategories(params) {
  return get('/categories', params)
}

export function getCategoryList(params) {
  return get('/categories/list', params)
}

export function getSubCategories(parentId) {
  return get(`/categories/sub/${parentId}`)
}

export function createCategory(data) {
  return post('/categories', data)
}

export function updateCategory(id, data) {
  return put(`/categories/${id}`, data)
}

export function deleteCategory(id) {
  return del(`/categories/${id}`)
}

export function moveCategory(id, direction) {
  return put(`/categories/${id}/move`, { direction })
}
