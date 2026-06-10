<template>
  <div class="register-page">
    <div class="register-container">
      <div class="register-left">
        <div class="brand">
          <el-icon size="48" class="brand-icon"><Wallet /></el-icon>
          <h1>资产与预算管理系统</h1>
          <p>开启您的智能理财之旅</p>
        </div>
        <div class="benefits">
          <div class="benefit-item">
            <el-icon size="20"><CircleCheck /></el-icon>
            <span>多账户独立管理</span>
          </div>
          <div class="benefit-item">
            <el-icon size="20"><CircleCheck /></el-icon>
            <span>实时预算监控预警</span>
          </div>
          <div class="benefit-item">
            <el-icon size="20"><CircleCheck /></el-icon>
            <span>账单批量导入</span>
          </div>
          <div class="benefit-item">
            <el-icon size="20"><CircleCheck /></el-icon>
            <span>多维度统计分析</span>
          </div>
        </div>
      </div>

      <div class="register-right">
        <el-card class="register-card">
          <h2 class="title">创建账户</h2>
          
          <el-form :model="form" :rules="rules" ref="formRef">
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="用户名（3-20个字符）" size="large" :prefix-icon="User" />
            </el-form-item>
            
            <el-form-item prop="nickname">
              <el-input v-model="form.nickname" placeholder="昵称（可选）" size="large" :prefix-icon="Avatar" />
            </el-form-item>
            
            <el-form-item prop="password">
              <el-input v-model="form.password" type="password" placeholder="密码（6-32个字符）" size="large" 
                :prefix-icon="Lock" show-password />
            </el-form-item>
            
            <el-form-item prop="confirmPassword">
              <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" size="large" 
                :prefix-icon="Lock" show-password @keyup.enter="handleRegister" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" size="large" class="register-btn" :loading="loading" @click="handleRegister">
                注册
              </el-button>
            </el-form-item>
            
            <div class="login-tip">
              已有账户？
              <router-link to="/login">立即登录</router-link>
            </div>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Avatar } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  nickname: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度3-20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度6-32个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

async function handleRegister() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await userStore.doRegister(form.username, form.password, form.nickname)
    if (res.code === 200) {
      ElMessage.success('注册成功')
      router.push('/')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.register-container {
  width: 900px;
  height: 560px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
}

.register-left {
  width: 50%;
  background: linear-gradient(135deg, #67c23a 0%, #409eff 100%);
  color: #fff;
  padding: 60px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.brand-icon {
  margin-bottom: 20px;
}

.brand h1 {
  font-size: 26px;
  margin-bottom: 12px;
}

.brand p {
  font-size: 14px;
  opacity: 0.9;
}

.benefits {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.benefit-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.register-right {
  width: 50%;
  padding: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.register-card {
  width: 100%;
  border: none;
  box-shadow: none;
}

.title {
  text-align: center;
  margin-bottom: 24px;
  font-size: 22px;
  color: #303133;
}

.register-btn {
  width: 100%;
}

.login-tip {
  text-align: center;
  font-size: 14px;
  color: #909399;
}

.login-tip a {
  color: #409eff;
}
</style>
