import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import './styles/index.css'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.config.globalProperties.$filters = {
  formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) return '0.00'
    return Number(value).toFixed(2)
  },
  formatPercent(value) {
    if (value === null || value === undefined) return '0%'
    return (value * 100).toFixed(1) + '%'
  }
}

app.mount('#app')
