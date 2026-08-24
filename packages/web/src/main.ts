import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppEditor from './AppEditor.vue'
import './style.css'

createApp(AppEditor).use(createPinia()).mount('#app')

// PWA Service Worker（file:// 桌面版跳过）
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    /* 注册失败不影响使用 */
  })
}
