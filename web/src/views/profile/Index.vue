<template>
  <div class="profile-page">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card class="user-card">
          <div class="user-info">
            <el-avatar :size="80" class="user-avatar">
              {{ userStore.userInfo?.nickname?.charAt(0) || 'U' }}
            </el-avatar>
            <h3 class="username">{{ userStore.userInfo?.nickname || userStore.userInfo?.username }}</h3>
            <p class="user-account">@{{ userStore.userInfo?.username }}</p>
            <el-tag size="small" type="primary">{{ userStore.userInfo?.role === 'admin' ? '管理员' : '普通用户' }}</el-tag>
          </div>
          
          <div class="user-stats">
            <div class="stat-item">
              <p class="stat-value">{{ accountCount }}</p>
              <p class="stat-label">账户数</p>
            </div>
            <div class="stat-item">
              <p class="stat-value">{{ billCount }}</p>
              <p class="stat-label">账单数</p>
            </div>
            <div class="stat-item">
              <p class="stat-value">{{ budgetCount }}</p>
              <p class="stat-label">预算项</p>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card>
          <template #header>
            <span class="card-title">基本信息</span>
          </template>
          
          <el-form :model="profileForm" label-width="100px" style="max-width: 500px">
            <el-form-item label="用户名">
              <el-input v-model="profileForm.username" disabled />
            </el-form-item>
            <el-form-item label="昵称">
              <el-input v-model="profileForm.nickname" maxlength="50" show-word-limit />
            </el-form-item>
            <el-form-item label="注册时间">
              <span>{{ userStore.userInfo?.created_at }}</span>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveProfile">保存修改</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <el-card style="margin-top: 20px">
          <template #header>
            <span class="card-title">修改密码</span>
          </template>
          
          <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="100px" style="max-width: 500px">
            <el-form-item label="原密码" prop="oldPassword">
              <el-input v-model="passwordForm.oldPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="passwordForm.newPassword" type="password" show-password />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="changingPwd" @click="changePassword">修改密码</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/user'
import { updateProfile } from '@/api/auth'
import { getAccounts } from '@/api/account'
import { getBills } from '@/api/bill'
import { getBudgets } from '@/api/budget'

const userStore = useUserStore()

const saving = ref(false)
const changingPwd = ref(false)
const passwordFormRef = ref(null)
const accountCount = ref(0)
const billCount = ref(0)
const budgetCount = ref(0)

const profileForm = reactive({
  username: '',
  nickname: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, max: 32, message: '密码长度6-32个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

async function loadCounts() {
  try {
    const [accRes, billRes, budgetRes] = await Promise.all([
      getAccounts(),
      getBills({ page: 1, pageSize: 1 }),
      getBudgets()
    ])
    
    if (accRes.code === 200) accountCount.value = accRes.data?.length || 0
    if (billRes.code === 200) billCount.value = billRes.data?.total || 0
    if (budgetRes.code === 200) budgetCount.value = budgetRes.data?.list?.length || 0
  } catch (e) {}
}

async function saveProfile() {
  saving.value = true
  try {
    const res = await updateProfile({ nickname: profileForm.nickname })
    if (res.code === 200) {
      ElMessage.success('保存成功')
      userStore.userInfo.nickname = profileForm.nickname
    }
  } finally {
    saving.value = false
  }
}

async function changePassword() {
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
  } catch {
    return
  }

  changingPwd.value = true
  try {
    const res = await userStore.updatePassword(passwordForm.oldPassword, passwordForm.newPassword)
    if (res.code === 200) {
      ElMessage.success('密码修改成功')
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
    }
  } finally {
    changingPwd.value = false
  }
}

onMounted(() => {
  profileForm.username = userStore.userInfo?.username || ''
  profileForm.nickname = userStore.userInfo?.nickname || ''
  loadCounts()
})
</script>

<style scoped>
.profile-page {
  padding: 0;
}

.user-card {
  text-align: center;
}

.user-info {
  padding: 20px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 20px;
}

.user-avatar {
  background: linear-gradient(135deg, #409eff, #67c23a);
  color: #fff;
  font-size: 32px;
  margin-bottom: 16px;
}

.username {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.user-account {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}

.user-stats {
  display: flex;
  justify-content: space-around;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.card-title {
  font-weight: 600;
  font-size: 15px;
}
</style>
