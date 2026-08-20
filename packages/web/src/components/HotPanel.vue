<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchHotItems, fetchHotSources, HotApiError, type HotItem, type HotSource } from '@typeduck/core'
import { useEditorStore } from '../stores/editor'

const emit = defineEmits<{ (e: 'close'): void }>()
const editor = useEditorStore()

const KEY_STORE = 'typeduck:hotKey'
const SOURCE_STORE = 'typeduck:hotSourceId'
const SOURCES_CACHE = 'typeduck:hotSources'
const SOURCES_AT = 'typeduck:hotSourcesAt'
/** 源列表缓存 1 小时，省调用额度 */
const CACHE_TTL = 60 * 60 * 1000

const apiKey = ref(localStorage.getItem(KEY_STORE) ?? '')
const keyInput = ref(apiKey.value)
const hasKey = computed(() => !!apiKey.value)

const sources = ref<HotSource[]>([])
const sourceId = ref<number | null>(null)
const items = ref<HotItem[]>([])
const loading = ref(false)
const error = ref('')

async function saveKey() {
  const k = keyInput.value.trim()
  if (!k) return
  apiKey.value = k
  localStorage.setItem(KEY_STORE, k)
  await loadSources(true)
}

async function loadSources(force = false) {
  loading.value = true
  error.value = ''
  try {
    if (!force) {
      try {
        const at = Number(localStorage.getItem(SOURCES_AT) || 0)
        if (Date.now() - at < CACHE_TTL) {
          const cached = JSON.parse(localStorage.getItem(SOURCES_CACHE) || '[]') as HotSource[]
          if (cached.length) {
            applySources(cached)
            return
          }
        }
      } catch {
        /* 缓存损坏按无缓存处理 */
      }
    }
    const list = await fetchHotSources(apiKey.value)
    localStorage.setItem(SOURCES_CACHE, JSON.stringify(list))
    localStorage.setItem(SOURCES_AT, String(Date.now()))
    applySources(list)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    // Key 失效：清掉回到输入态重新填
    if (e instanceof HotApiError && e.status === 401) {
      apiKey.value = ''
      keyInput.value = ''
      localStorage.removeItem(KEY_STORE)
    }
  } finally {
    loading.value = false
  }
}

function applySources(list: HotSource[]) {
  sources.value = list
  const saved = Number(localStorage.getItem(SOURCE_STORE))
  sourceId.value = list.some((s) => s.id === saved) ? saved : (list[0]?.id ?? null)
  loadItems()
}

async function loadItems() {
  if (sourceId.value == null) return
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchHotItems(apiKey.value, sourceId.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    items.value = []
  } finally {
    loading.value = false
  }
}

function onSourceChange() {
  if (sourceId.value != null) localStorage.setItem(SOURCE_STORE, String(sourceId.value))
  loadItems()
}

/** 热点一键转选题：新建文档，标题自动提取自 H1，原文链接留在引用里 */
async function toTopic(item: HotItem) {
  await editor.createDoc(`# ${item.title}\n\n> 原文：[${item.title}](${item.jump_url})\n\n`)
  editor.showToast('已创建选题文档，开写吧 ✍️')
}

onMounted(() => {
  if (hasKey.value) loadSources()
})
</script>

<template>
  <div class="panel-head">
    <span>🔥 热点选题</span>
    <span class="head-btns">
      <button class="mini-btn" title="收起面板" @click="emit('close')">✕</button>
    </span>
  </div>

  <div class="hot-scroll">
    <!-- 未配置 Key -->
    <div v-if="!hasKey" class="key-form">
      <p class="dim">
        填写 allnet.hot 的 API Key（免费注册，每日 2000 次调用），即可订阅知乎热榜、微博热搜等约 50 个热点源。
      </p>
      <input
        v-model="keyInput"
        type="password"
        placeholder="粘贴你的 X-API-Key"
        spellcheck="false"
        @keyup.enter="saveKey"
      />
      <button class="run" :disabled="!keyInput.trim()" @click="saveKey">保 存</button>
      <a class="key-link" href="https://allnet.hot/" target="_blank" rel="noopener">去 allnet.hot 获取 Key ↗</a>
    </div>

    <template v-else>
      <div class="hot-toolbar">
        <select v-model="sourceId" @change="onSourceChange">
          <option v-for="s in sources" :key="s.id" :value="s.id">{{ s.title }}</option>
        </select>
        <button class="refresh" title="刷新当前榜单" @click="loadItems">⟳</button>
      </div>

      <p v-if="error" class="hot-error">
        {{ error }}
        <button class="retry" @click="loadSources(true)">重试</button>
      </p>
      <p v-else-if="loading" class="dim">加载中…</p>
      <p v-else-if="!items.length && sources.length" class="dim">该源暂无内容</p>

      <ol class="hot-list">
        <li v-for="(it, i) in items" :key="it.jump_url + i">
          <a :href="it.jump_url" target="_blank" rel="noopener" class="hot-title">{{ it.title }}</a>
          <button class="to-topic" title="以此热点创建选题文档" @click="toTopic(it)">转选题</button>
        </li>
      </ol>
    </template>
  </div>
</template>

<style scoped>
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
  flex-shrink: 0;
}
.head-btns {
  display: inline-flex;
  gap: 2px;
}
.mini-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #999;
  font-size: 13px;
  cursor: pointer;
}
.mini-btn:hover {
  background: #f2f3f5;
  color: #333;
}
.hot-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.dim {
  font-size: 12px;
  color: #a8adb5;
  line-height: 1.8;
  margin: 0 0 10px;
}

/* Key 配置态 */
.key-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.key-form input {
  height: 34px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  font-family: Menlo, Consolas, monospace;
}
.key-form input:focus {
  border-color: #07c160;
}
.run {
  height: 32px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.run:hover {
  background: #06ad56;
}
.run:disabled {
  opacity: 0.45;
  cursor: default;
}
.key-link {
  font-size: 12.5px;
  color: #07c160;
  text-decoration: none;
  text-align: center;
}
.key-link:hover {
  text-decoration: underline;
}

/* 榜单态 */
.hot-toolbar {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.hot-toolbar select {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 8px;
  font-size: 12.5px;
  color: #1d2129;
  background: #fff;
  outline: none;
  cursor: pointer;
}
.refresh {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 15px;
  cursor: pointer;
  flex-shrink: 0;
}
.refresh:hover {
  background: #f2f3f5;
}
.hot-error {
  font-size: 12.5px;
  color: #e5554e;
  line-height: 1.6;
  margin: 0 0 10px;
}
.retry {
  border: none;
  background: transparent;
  color: #07c160;
  font-size: 12.5px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.hot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.hot-list li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 2px;
  border-bottom: 1px dashed #eef0f2;
}
.hot-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #1d2129;
  text-decoration: none;
  word-break: break-all;
}
.hot-title:hover {
  color: #07c160;
}
.hot-title::before {
  counter-increment: hot;
  content: counter(hot);
  display: inline-block;
  width: 18px;
  height: 18px;
  margin-right: 6px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  text-align: center;
  line-height: 18px;
  font-weight: 600;
}
.hot-list {
  counter-reset: hot;
}
.to-topic {
  flex-shrink: 0;
  height: 24px;
  padding: 0 9px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.to-topic:hover {
  border-color: #07c160;
  color: #07c160;
}
</style>
