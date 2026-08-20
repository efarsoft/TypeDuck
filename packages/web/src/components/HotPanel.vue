<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  DEFAULT_NEWSNOW_BASE,
  HOT_SOURCES,
  fetchHotItems,
  type HotItem,
} from '@typeduck/core'
import { useEditorStore } from '../stores/editor'
import { fetchText } from '../utils/net'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'rewrite', item: HotItem): void
}>()
const editor = useEditorStore()

const BASE_STORE = 'typeduck:hotBase'
const SOURCE_STORE = 'typeduck:hotSource'

const baseUrl = ref(localStorage.getItem(BASE_STORE) || DEFAULT_NEWSNOW_BASE)
const baseInput = ref(baseUrl.value)
const showConfig = ref(false)

const sourceId = ref(
  HOT_SOURCES.some((s) => s.id === localStorage.getItem(SOURCE_STORE))
    ? (localStorage.getItem(SOURCE_STORE) as string)
    : HOT_SOURCES[0].id,
)

const items = ref<HotItem[]>([])
const loading = ref(false)
const error = ref('')

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    items.value = await fetchHotItems(baseUrl.value, sourceId.value, fetchText)
  } catch (e) {
    // 浏览器 fetch 遇 CORS 直接抛 TypeError，换成可读的提示
    if (e instanceof TypeError) {
      error.value = '该实例未开放跨域（CORS），网页版受限——桌面版不受影响，或点 ⚙ 更换实例地址'
    } else {
      error.value = e instanceof Error ? e.message : String(e)
    }
    items.value = []
  } finally {
    loading.value = false
  }
}

function onSourceChange() {
  localStorage.setItem(SOURCE_STORE, sourceId.value)
  loadItems()
}

function saveBase() {
  const b = baseInput.value.trim().replace(/\/+$/, '')
  if (!b.startsWith('https://')) {
    error.value = '实例地址必须是 https:// 开头'
    return
  }
  baseUrl.value = b
  localStorage.setItem(BASE_STORE, b)
  showConfig.value = false
  loadItems()
}

/** 热点一键转选题：新建文档，标题自动提取自 H1，原文链接留在引用里 */
async function toTopic(item: HotItem) {
  await editor.createDoc(`# ${item.title}\n\n> 原文：[${item.title}](${item.url})\n\n`)
  editor.showToast('已创建选题文档，开写吧 ✍️')
}

onMounted(loadItems)
</script>

<template>
  <div class="panel-head">
    <span>🔥 热点选题</span>
    <span class="head-btns">
      <button class="mini-btn" title="实例地址（默认公共实例，可换自部署）" @click="showConfig = !showConfig">⚙</button>
      <button class="mini-btn" title="收起面板" @click="emit('close')">✕</button>
    </span>
  </div>

  <div class="hot-scroll">
    <!-- 实例地址配置 -->
    <div v-if="showConfig" class="base-form">
      <label>NewsNow 实例地址</label>
      <input v-model="baseInput" placeholder="https://newsnow.busiyi.world" spellcheck="false" @keyup.enter="saveBase" />
      <div class="base-ops">
        <button class="run" @click="saveBase">保存</button>
        <button class="reset" @click="baseInput = DEFAULT_NEWSNOW_BASE">恢复默认</button>
      </div>
      <p class="dim">默认为公共实例。网页版若受跨域限制，可换成自部署实例地址；桌面版不受限制。</p>
    </div>

    <div class="hot-toolbar">
      <select v-model="sourceId" @change="onSourceChange">
        <option v-for="s in HOT_SOURCES" :key="s.id" :value="s.id">{{ s.title }}</option>
      </select>
      <button class="refresh" title="刷新当前榜单" @click="loadItems">⟳</button>
    </div>

    <p v-if="error" class="hot-error">{{ error }}</p>
    <p v-else-if="loading" class="dim">加载中…</p>
    <p v-else-if="!items.length" class="dim">该源暂无内容</p>

    <ol class="hot-list">
      <li v-for="(it, i) in items" :key="it.url + i">
        <span class="hot-num">{{ i + 1 }}</span>
        <a :href="it.url" target="_blank" rel="noopener" class="hot-title">{{ it.title }}</a>
        <span v-if="it.info" class="hot-info">{{ it.info }}</span>
        <span class="hot-ops">
          <button class="to-topic" title="AI 抓取原文并改写成 Markdown 初稿" @click="emit('rewrite', it)">AI 改写</button>
          <button class="to-topic plain" title="以此热点创建空白选题文档" @click="toTopic(it)">转选题</button>
        </span>
      </li>
    </ol>
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
}
.dim {
  font-size: 12px;
  color: #a8adb5;
  line-height: 1.8;
  margin: 0 0 10px;
}

/* 实例地址配置 */
.base-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fafbfc;
}
.base-form label {
  font-size: 12.5px;
  font-weight: 600;
  color: #4e5969;
}
.base-form input {
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 12.5px;
  color: #1d2129;
  outline: none;
  font-family: Menlo, Consolas, monospace;
}
.base-form input:focus {
  border-color: #07c160;
}
.base-ops {
  display: flex;
  gap: 8px;
}
.run {
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.run:hover {
  background: #06ad56;
}
.reset {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12.5px;
  cursor: pointer;
}
.reset:hover {
  background: #f2f3f5;
}

/* 榜单 */
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
.hot-num {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  border-radius: 4px;
  background: #f2f3f5;
  color: #86909c;
  font-size: 11px;
  text-align: center;
  line-height: 18px;
  font-weight: 600;
}
.hot-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #1d2129;
  text-decoration: none;
  /* 英文单词保持完整（break-all 会把 ThreeJs 拆成两行），中文自然换行 */
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.hot-title:hover {
  color: #07c160;
}
.hot-info {
  flex-shrink: 0;
  max-width: 88px;
  font-size: 10.5px;
  color: #a8adb5;
  padding-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
.hot-ops {
  display: inline-flex;
  gap: 4px;
  flex-shrink: 0;
}
/* AI 改写是主推动作，绿色描边突出 */
.to-topic:not(.plain) {
  border-color: #07c160;
  color: #07c160;
}
.to-topic:not(.plain):hover {
  background: #f0faf4;
}
</style>
