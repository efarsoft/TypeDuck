<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import AppEditor from './AppEditor.vue'
import Home from './views/Home.vue'

/**
 * 零依赖 hash 路由（避免引入 vue-router，省去联网安装）：
 * - `#/editor` 及其子路径 → 编辑器
 * - 其余（`#/`、`#`、空、`#/download` 等区块锚点）→ 首页
 * 区块锚点（如 #/download）由 Home 自身在挂载时平滑滚动到位。
 */
type Route = 'home' | 'editor'
const route = ref<Route>('home')

function resolve() {
  route.value = window.location.hash.startsWith('#/editor') ? 'editor' : 'home'
}

function onHashChange() {
  resolve()
}

onMounted(() => {
  resolve()
  window.addEventListener('hashchange', onHashChange)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <Home v-if="route === 'home'" />
  <AppEditor v-else />
</template>
