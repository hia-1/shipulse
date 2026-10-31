import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 本地自托管字体（DESIGN.md Typography）：标题/书名 Noto Serif SC，正文/数据 Inter
import '@fontsource/noto-serif-sc/500.css'
import '@fontsource/noto-serif-sc/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './assets/main.css'
import { useTheme } from './composables/useTheme'

// 初始化主题（跟随系统 / 记忆上次选择）
useTheme()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
