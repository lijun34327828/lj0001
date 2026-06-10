<template>
  <div class="not-found">
    <div class="content">
      <h1 class="code">404</h1>
      <p class="desc">页面走丢了</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.not-found {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.content {
  text-align: center;
}

.code {
  font-size: 120px;
  font-weight: 700;
  background: linear-gradient(135deg, #409eff, #67c23a);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 20px;
}

.desc {
  font-size: 18px;
  color: #606266;
  margin-bottom: 30px;
}
</style>
