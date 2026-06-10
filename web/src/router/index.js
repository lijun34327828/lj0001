import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/Login.vue'),
    meta: { title: '登录', requiresAuth: false }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/Register.vue'),
    meta: { title: '注册', requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/layout/MainLayout.vue'),
    redirect: '/dashboard',
    meta: { requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/Index.vue'),
        meta: { title: '首页', icon: 'HomeFilled' }
      },
      {
        path: 'bills',
        name: 'Bills',
        component: () => import('@/views/bill/Index.vue'),
        meta: { title: '账单管理', icon: 'List' }
      },
      {
        path: 'budgets',
        name: 'Budgets',
        component: () => import('@/views/budget/Index.vue'),
        meta: { title: '预算管理', icon: 'Wallet' }
      },
      {
        path: 'assets',
        name: 'Assets',
        component: () => import('@/views/asset/Index.vue'),
        meta: { title: '资产管理', icon: 'Box' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/statistics/Index.vue'),
        meta: { title: '统计分析', icon: 'DataAnalysis' }
      },
      {
        path: 'accounts',
        name: 'Accounts',
        component: () => import('@/views/account/Index.vue'),
        meta: { title: '账户管理', icon: 'CreditCard' }
      },
      {
        path: 'categories',
        name: 'Categories',
        component: () => import('@/views/category/Index.vue'),
        meta: { title: '分类管理', icon: 'Menu' }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/Index.vue'),
        meta: { title: '个人中心', icon: 'User' }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/error/NotFound.vue'),
    meta: { title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  document.title = to.meta.title ? `${to.meta.title} - 资产与预算管理系统` : '资产与预算管理系统'
  
  if (to.meta.requiresAuth && !userStore.token) {
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if ((to.path === '/login' || to.path === '/register') && userStore.token) {
    next({ path: '/' })
  } else {
    next()
  }
})

export default router
