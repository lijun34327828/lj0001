import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/user'
import router from '@/router'

const service = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

let isRefreshing = false
let failedQueue = []

function processQueue(error, token = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

service.interceptors.request.use(
  config => {
    const userStore = useUserStore()
    if (userStore.token) {
      config.headers.Authorization = `Bearer ${userStore.token}`
    }
    
    if (config.method === 'post' 
        && !config.headers['X-Idempotency-Key']
        && config.headers['Content-Type'] !== 'multipart/form-data'
        && !config.skipIdempotency) {
      const idempotencyKey = generateIdempotencyKey()
      config.headers['X-Idempotency-Key'] = idempotencyKey
    }
    
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    const res = response.data
    
    if (res.code === 401) {
      const userStore = useUserStore()
      userStore.logout()
      ElMessage.error('登录已过期，请重新登录')
      router.push('/login')
      return Promise.reject(new Error(res.message || '未授权'))
    }
    
    if (res.code === 429) {
      ElMessage.warning('请求过于频繁，请稍后再试')
      return Promise.reject(new Error(res.message || '请求过于频繁'))
    }
    
    return res
  },
  error => {
    const userStore = useUserStore()
    
    if (error.response) {
      const status = error.response.status
      
      if (status === 401) {
        userStore.logout()
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login')
      } else if (status === 403) {
        ElMessage.error('没有权限访问该资源')
      } else if (status === 404) {
        ElMessage.error('请求的资源不存在')
      } else if (status === 408) {
        ElMessage.error('请求超时，请稍后重试')
      } else if (status === 409) {
        ElMessage.warning(error.response.data?.message || '操作冲突')
      } else if (status === 429) {
        ElMessage.warning('请求过于频繁，请稍后再试')
      } else if (status >= 500) {
        ElMessage.error('服务器错误，请稍后重试')
      } else {
        ElMessage.error(error.response.data?.message || '请求失败')
      }
    } else if (error.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请稍后重试')
    } else if (error.message === 'Network Error') {
      ElMessage.error('网络错误，请检查网络连接')
    } else {
      ElMessage.error(error.message || '请求失败')
    }
    
    return Promise.reject(error)
  }
)

function generateIdempotencyKey() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export default service

export function request(config) {
  return service(config)
}

export function get(url, params) {
  return service({ url, method: 'get', params })
}

export function post(url, data, config = {}) {
  return service({ url, method: 'post', data, ...config })
}

export function put(url, data, config = {}) {
  return service({ url, method: 'put', data, ...config })
}

export function del(url, data, config = {}) {
  return service({ url, method: 'delete', data, ...config })
}

export function upload(url, file, onProgress) {
  const formData = new FormData()
  formData.append('file', file)
  
  return service({
    url,
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: progressEvent => {
      if (onProgress) {
        const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
        onProgress(percent)
      }
    }
  })
}
