import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login, register, getProfile, changePasswordApi } from '@/api/auth'

export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const userInfo = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  async function doLogin(username, password) {
    const res = await login(username, password)
    if (res.code === 200) {
      token.value = res.data.token
      userInfo.value = res.data.user
      return res
    }
    return res
  }

  async function doRegister(username, password, nickname) {
    const res = await register(username, password, nickname)
    if (res.code === 200) {
      token.value = res.data.token
      userInfo.value = res.data.user
      return res
    }
    return res
  }

  function logout() {
    token.value = ''
    userInfo.value = null
  }

  async function fetchProfile() {
    const res = await getProfile()
    if (res.code === 200) {
      userInfo.value = res.data
    }
    return res
  }

  async function updatePassword(oldPassword, newPassword) {
    return await changePasswordApi(oldPassword, newPassword)
  }

  return {
    token,
    userInfo,
    isLoggedIn,
    doLogin,
    doRegister,
    logout,
    fetchProfile,
    updatePassword
  }
}, {
  persist: {
    paths: ['token', 'userInfo']
  }
})
