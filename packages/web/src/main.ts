import { createApp } from 'vue'
import { createPinia } from 'pinia'
import AppEditor from './AppEditor.vue'
import './style.css'

createApp(AppEditor).use(createPinia()).mount('#app')
