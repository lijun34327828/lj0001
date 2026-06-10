import { get, post, put, del, upload, service } from '@/utils/request'

export function getBills(params) {
  return get('/bills', params)
}

export function getBill(id) {
  return get(`/bills/${id}`)
}

export function createBill(data) {
  return post('/bills', data)
}

export function updateBill(id, data) {
  return put(`/bills/${id}`, data)
}

export function deleteBill(id) {
  return del(`/bills/${id}`)
}

export function batchDeleteBills(ids) {
  return post('/bills/batch-delete', { ids })
}

export function getBillHistory(id, params) {
  return get(`/bills/${id}/history`, params)
}

export function importBills(file, accountId, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('account_id', accountId)
  return service({
    url: '/bills/import',
    method: 'post',
    data: formData,
    skipIdempotency: true,
    onUploadProgress: progressEvent => {
      if (onProgress && progressEvent.total) {
        onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
      }
    }
  })
}

export function previewImport(file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  return service({
    url: '/bills/import/preview',
    method: 'post',
    data: formData,
    skipIdempotency: true,
    onUploadProgress: progressEvent => {
      if (onProgress && progressEvent.total) {
        onProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100))
      }
    }
  })
}

export function downloadTemplate() {
  return get('/bills/export/template')
}
