<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useEditorStore } from '../stores/editor'
import { fetchText } from '../utils/net'
import { extractArticle } from '../utils/article'

const emit = defineEmits<{ (e: 'close'): void }>()
const store = useEditorStore()

/** 参考条目：抓取的文章 / 粘贴的文字 / 粘贴或上传的截图 */
interface RefItem {
  id: string
  kind: 'article' | 'text' | 'image'
  title?: string
  text?: string
  url?: string
  src?: string
  name?: string
}

const KIND_LABEL: Record<RefItem['kind'], string> = { article: '文章', text: '文字', image: '图片' }

const urlInput = ref('')
const textInput = ref('')
const fetching = ref(false)
const items = ref<RefItem[]>([])
const fileInput = ref<HTMLInputElement>()

let uid = 0
function nextId() {
  return `ref-${Date.now()}-${uid++}`
}

/** 网址 → 抓取 HTML → 提取正文（Readability），加入参考列表 */
async function fetchUrl() {
  const url = urlInput.value.trim()
  if (!/^https?:\/\//.test(url)) {
    store.showToast('请输入以 http(s):// 开头的网址')
    return
  }
  fetching.value = true
  try {
    const html = await fetchText(url)
    const article = extractArticle(html, url)
    if (article.text.length < 120) {
      store.showToast('未能提取到正文：页面可能需登录或被反爬')
      return
    }
    items.value.unshift({
      id: nextId(),
      kind: 'article',
      title: article.title || url,
      text: article.text,
      url,
    })
    urlInput.value = ''
    store.showToast('参考文章已加入 📄')
  } catch {
    store.showToast('抓取失败：请检查网址或网络')
  } finally {
    fetching.value = false
  }
}

function addText() {
  const t = textInput.value.trim()
  if (!t) return
  items.value.unshift({ id: nextId(), kind: 'text', text: t })
  textInput.value = ''
  store.showToast('参考文字已加入')
}

function addImage(file: File) {
  const src = URL.createObjectURL(file)
  items.value.unshift({ id: nextId(), kind: 'image', src, name: file.name || '图片' })
  store.showToast('图片已加入 🖼')
}

/** 面板内粘贴：有图片就收为图片条目，纯文字放行给输入框 */
function onPaste(e: ClipboardEvent) {
  const img = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
  if (!img) return
  e.preventDefault()
  const file = img.getAsFile()
  if (file) addImage(file)
}

function onUpload(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) addImage(files[0])
  ;(e.target as HTMLInputElement).value = ''
}

function removeItem(id: string) {
  const it = items.value.find((i) => i.id === id)
  if (it?.src) URL.revokeObjectURL(it.src)
  items.value = items.value.filter((i) => i.id !== id)
}

function clearAll() {
  items.value.forEach((i) => i.src && URL.revokeObjectURL(i.src))
  items.value = []
}

onUnmounted(clearAll)
</script>

<template>
  <div class="panel-head">
    <span>📄 参考文</span>
    <span class="head-btns">
      <button v-if="items.length" class="mini-btn" title="清空全部" @click="clearAll">清空</button>
      <button class="mini-btn" title="收起面板" @click="emit('close')">✕</button>
    </span>
  </div>

  <div class="ref-scroll" @paste="onPaste">
    <!-- 输入区：网址抓取 / 粘贴文字 / 截图 -->
    <div class="ref-input">
      <div class="row">
        <input
          v-model="urlInput"
          class="url-input"
          placeholder="粘贴网址，回车抓取渲染"
          @keyup.enter="fetchUrl"
        />
        <button class="go" :disabled="fetching" @click="fetchUrl">{{ fetching ? '…' : '抓取' }}</button>
      </div>
      <div class="row">
        <textarea
          v-model="textInput"
          class="text-input"
          rows="3"
          placeholder="粘贴复制过来的文字…"
        ></textarea>
        <button class="go" :disabled="!textInput.trim()" @click="addText">添加</button>
      </div>
      <div class="row tip">
        <button class="upload" @click="fileInput?.click()">🖼 上传图片</button>
        <span>也可在面板内 Ctrl+V 直接粘贴图片</span>
      </div>
    </div>

    <!-- 参考条目列表 -->
    <div v-if="items.length" class="ref-items">
      <div v-for="it in items" :key="it.id" class="ref-card">
        <div class="card-head">
          <span class="kind">{{ KIND_LABEL[it.kind] }}</span>
          <span v-if="it.title" class="card-title" :title="it.title">{{ it.title }}</span>
          <button class="mini-btn" title="移除" @click="removeItem(it.id)">✕</button>
        </div>
        <img v-if="it.kind === 'image'" class="ref-img" :src="it.src" :alt="it.name" />
        <p v-else class="ref-text">{{ it.text }}</p>
        <a v-if="it.url" class="ref-link" :href="it.url" target="_blank" rel="noopener">原文链接 ↗</a>
      </div>
    </div>
    <p v-else class="dim">把参考资料放这里：<br />· 网址 → 抓取并渲染正文<br />· 复制的文字 → 粘贴添加<br />· 图片 → 粘贴或上传</p>

    <input ref="fileInput" type="file" accept="image/*" hidden @change="onUpload" />
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
  height: 26px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
}
.mini-btn:hover {
  background: #f2f3f5;
  color: #333;
}
.ref-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 输入区 */
.ref-input {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
.url-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 12.5px;
  color: #1d2129;
  outline: none;
}
.url-input:focus {
  border-color: #07c160;
}
.text-input {
  flex: 1;
  min-width: 0;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 8px 10px;
  font-size: 12.5px;
  color: #1d2129;
  outline: none;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
}
.text-input:focus {
  border-color: #07c160;
}
.go {
  flex-shrink: 0;
  align-self: stretch;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.go:hover {
  background: #06ad56;
}
.go:disabled {
  opacity: 0.45;
  cursor: default;
}
.tip {
  align-items: center;
  gap: 8px;
}
.upload {
  flex-shrink: 0;
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  font-size: 12px;
  cursor: pointer;
}
.upload:hover {
  border-color: #07c160;
  color: #07c160;
}
.tip span {
  font-size: 11px;
  color: #a8adb5;
}

/* 参考条目 */
.ref-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}
.ref-card {
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  overflow: hidden;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-bottom: 1px solid #eef0f2;
}
.kind {
  flex-shrink: 0;
  font-size: 10.5px;
  color: #07c160;
  border: 1px solid #b8dfc7;
  background: #e7f7ee;
  border-radius: 4px;
  padding: 1px 6px;
  font-weight: 600;
}
.card-title {
  flex: 1;
  min-width: 0;
  font-size: 12.5px;
  font-weight: 600;
  color: #1d2129;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ref-text {
  margin: 0;
  padding: 10px;
  font-size: 12.5px;
  line-height: 1.7;
  color: #3a4440;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 280px;
  overflow-y: auto;
}
.ref-img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  margin: 10px auto;
  border-radius: 6px;
  object-fit: contain;
}
.ref-link {
  display: inline-block;
  margin: 0 10px 10px;
  font-size: 11.5px;
  color: #07c160;
  text-decoration: none;
}
.ref-link:hover {
  text-decoration: underline;
}
.dim {
  font-size: 12px;
  color: #a8adb5;
  line-height: 1.9;
  margin: 0;
}
</style>
