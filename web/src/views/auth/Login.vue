<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-left">
        <div class="brand">
          <el-icon size="48" class="brand-icon"><Wallet /></el-icon>
          <h1>资产与预算管理系统</h1>
          <p>专业的个人财务解决方案</p>
        </div>
        <div class="features">
          <div class="feature-item">
            <el-icon size="24"><Lock /></el-icon>
            <span>多账户独立隔离</span>
          </div>
          <div class="feature-item">
            <el-icon size="24"><TrendCharts /></el-icon>
            <span>智能预算预警</span>
          </div>
          <div class="feature-item">
            <el-icon size="24"><DataLine /></el-icon>
            <span>多维度数据分析</span>
          </div>
        </div>
      </div>

      <div class="login-right">
        <el-card class="login-card">
          <h2 class="title">欢迎登录</h2>
          
          <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="handleLogin">
            <el-form-item prop="username">
              <el-input v-model="form.username" placeholder="请输入用户名" size="large" :prefix-icon="User" />
            </el-form-item>
            
            <el-form-item prop="password">
              <el-input v-model="form.password" type="password" placeholder="请输入密码" size="large" 
                :prefix-icon="Lock" show-password @keyup.enter="handleLogin" />
            </el-form-item>
            
            <el-form-item>
              <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
                登录
              </el-button>
            </el-form-item>
            
            <div class="register-tip">
              还没有账户？
              <router-link to="/register">立即注册</router-link>
            </div>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useUserStore } from '@/store/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度3-20个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度6-32个字符', trigger: 'blur' }
  ]
}

async function handleLogin() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true
  try {
    const res = await userStore.doLogin(form.username, form.password)
    if (res.code === 200) {
      ElMessage.success('登录成功')
      const redirect = route.query.redirect || '/'
      router.push(redirect)
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-container {
  width: 900px;
  height: 500px;
  background: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
}

.login-left {
  width: 50%;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
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
  font-size: 28px;
  margin-bottom: 12px;
}

.brand p {
  font-size: 14px;
  opacity: 0.9;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
}

.login-right {
  width: 50%;
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  border: none;
  box-shadow: none;
}

.title {
  text-align: center;
  margin-bottom: 30px;
  font-size: 24px;
  color: #303133;
}

.login-btn {
  width: 100%;
}

.register-tip {
  text-align: center;
  font-size: 14px;
  color: #909399;
}

.register-tip a {
  color: #409eff;
}
</style>
