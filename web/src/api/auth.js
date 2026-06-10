import { post, get, put } from '@/utils/request'

export function login(username, password) {
  return post('/auth/login', { username, password })
}

export function register(username, password, nickname) {
  return post('/auth/register', { username, password, nickname })
}

export function getProfile() {
  return get('/auth/profile')
}

export function updateProfile(data) {
  return put('/auth/profile', data)
}

export function changePasswordApi(oldPassword, newPassword) {
  return put('/auth/password', { oldPassword, newPassword })
}
