import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 相对路径：桌面版 file:// 协议加载 dist 时，绝对路径 /assets 会指向磁盘根目录导致白屏
  base: './',
  server: {
    port: 5173,
  },
})
