<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { searchStockImages, streamChat, type ImageProvider, type ImageResult } from '@typeduck/core'
import { useEditorStore } from '../stores/editor'
import { useAiStore } from '../stores/ai'
import ImageCropDialog from './ImageCropDialog.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'insert', markdown: string): void
}>()

const editor = useEditorStore()
const aiStore = useAiStore()

const CONFIG_STORE = 'typeduck:imageConfig'

function loadConfig(): { provider: ImageProvider; key: string } {
  try {
    const raw = localStorage.getItem(CONFIG_STORE)
    if (raw) return { provider: 'unsplash', key: '', ...JSON.parse(raw) }
  } catch {
    /* 损坏按未配置处理 */
  }
  return { provider: 'unsplash', key: '' }
}

const provider = ref<ImageProvider>(loadConfig().provider)
const apiKey = ref(loadConfig().key)
const keyInput = ref(apiKey.value)
const hasKey = computed(() => !!apiKey.value)

const KEY_GUIDES: Record<ImageProvider, { name: string; url: string; note: string }> = {
  unsplash: {
    name: 'Unsplash',
    url: 'https://unsplash.com/developers',
    note: '免费注册应用即得 Key，每小时 50 次搜索',
  },
  pexels: {
    name: 'Pexels',
    url: 'https://www.pexels.com/api/',
    note: '免费注册即得 Key，每小时 200 次搜索',
  },
}

function saveKey() {
  const k = keyInput.value.trim()
  if (!k) return
  apiKey.value = k
  localStorage.setItem(CONFIG_STORE, JSON.stringify({ provider: provider.value, key: k }))
}

function switchProvider(p: ImageProvider) {
  provider.value = p
  apiKey.value = ''
  keyInput.value = ''
}

/* ---------- 搜索 ---------- */

const query = ref('')
const results = ref<ImageResult[]>([])
const searching = ref(false)
const error = ref('')

async function search(q?: string) {
  const term = (q ?? query.value).trim()
  if (!term || !apiKey.value) return
  if (q) query.value = q
  searching.value = true
  error.value = ''
  try {
    results.value = await searchStockImages(provider.value, apiKey.value, term)
    if (!results.value.length) error.value = '没有找到相关图片，换个关键词试试'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    results.value = []
  } finally {
    searching.value = false
  }
}

/* ---------- AI 荐词：复用 BYOK 的 AI 配置，产出英文图库关键词 ---------- */

const keywords = ref<string[]>([])
const keywording = ref(false)

async function suggestKeywords() {
  if (!aiStore.isConfigured) {
    editor.showToast('AI 荐词需要先配置 AI（填你自己的 API Key）')
    return
  }
  const doc = editor.activeDoc
  const title =
    doc?.title?.trim() ||
    doc?.content.match(/^#{1,3}\s+(.+)$/m)?.[1] ||
    doc?.content.trim().slice(0, 40) ||
    ''
  if (!title) {
    editor.showToast('先写个标题或几句正文，AI 才知道配什么图')
    return
  }
  keywording.value = true
  keywords.value = []
  try {
    const text = await streamChat(aiStore.config, [
      {
        role: 'system',
        content:
          '你是公众号配图助手。根据文章标题生成 5 个图库搜索关键词：用英文（图库英文搜索结果更准），贴合文章主题且画面感强，每行一个，不要编号，不要任何解释。',
      },
      { role: 'user', content: `文章标题：${title}\n\n请输出 5 个英文图库搜索关键词。` },
    ])
    keywords.value = text
      .split('\n')
      .map((line) => line.trim().replace(/^[-*\d.、\s]+/, ''))
      .filter((line) => line && line.length <= 40)
      .slice(0, 5)
  } catch (e) {
    editor.showToast(e instanceof Error ? e.message : 'AI 荐词失败')
  } finally {
    keywording.value = false
  }
}

/* ---------- 图片操作 ---------- */

const cropping = ref<ImageResult | null>(null)

/** 插入 Markdown 图片（博客/文档直用；公众号不显示外链图，走下载上传） */
function insertImage(img: ImageResult) {
  emit('insert', `![配图 by ${img.author}](${img.full})\n\n`)
}

async function downloadImage(img: ImageResult) {
  try {
    const res = await fetch(img.full)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `typeduck-${Date.now().toString(36)}.jpg`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    editor.showToast('下载失败，可直接右键图片另存为')
  }
}

onMounted(() => {
  if (hasKey.value && !query.value) query.value = ''
})
</script>

<template>
  <div class="panel-head">
    <span>🖼 配图助手</span>
    <span class="head-btns">
      <button class="mini-btn" title="收起面板" @click="emit('close')">✕</button>
    </span>
  </div>

  <div class="img-scroll">
    <!-- 未配置 Key -->
    <div v-if="!hasKey" class="key-form">
      <p class="dim">选择图库并填写免费 API Key（注册即得），即可搜索高清免费配图。</p>
      <div class="provider-row">
        <button
          v-for="(g, p) in KEY_GUIDES"
          :key="p"
          class="provider-btn"
          :class="{ active: provider === p }"
          @click="switchProvider(p as ImageProvider)"
        >
          {{ g.name }}
        </button>
      </div>
      <input
        v-model="keyInput"
        type="password"
        placeholder="粘贴图库 API Key"
        spellcheck="false"
        @keyup.enter="saveKey"
      />
      <button class="run" :disabled="!keyInput.trim()" @click="saveKey">保 存</button>
      <a class="key-link" :href="KEY_GUIDES[provider].url" target="_blank" rel="noopener">
        去 {{ KEY_GUIDES[provider].name }} 获取 Key ↗
      </a>
      <p class="dim">{{ KEY_GUIDES[provider].note }}</p>
    </div>

    <template v-else>
      <div class="search-row">
        <input
          v-model="query"
          placeholder="英文关键词效果更佳，如 coding desk"
          spellcheck="false"
          @keyup.enter="search()"
        />
        <button class="search-btn" title="搜索" :disabled="searching || !query.trim()" @click="search()">
          {{ searching ? '…' : '🔍' }}
        </button>
      </div>
      <button class="ai-kw" :disabled="keywording" @click="suggestKeywords">
        {{ keywording ? 'AI 思考中…' : '✨ AI 根据文章推荐关键词' }}
      </button>
      <div v-if="keywords.length" class="kw-chips">
        <button v-for="k in keywords" :key="k" @click="search(k)">{{ k }}</button>
      </div>

      <p v-if="error" class="img-error">{{ error }}</p>
      <p v-else-if="!results.length && !searching" class="dim">输入关键词搜索免费高清图库。</p>

      <div v-if="results.length" class="img-grid">
        <figure v-for="img in results" :key="img.thumb" class="img-card">
          <img :src="img.thumb" :alt="img.author" loading="lazy" @click="insertImage(img)" />
          <figcaption>
            <span class="author" :title="`${img.author} · ${img.width}×${img.height}`">{{ img.author }}</span>
            <span class="ops">
              <button title="插入 Markdown 图片（博客/文档用）" @click="insertImage(img)">插入</button>
              <button title="下载图片" @click="downloadImage(img)">下载</button>
              <button title="裁剪为公众号封面" @click="cropping = img">封面</button>
            </span>
          </figcaption>
        </figure>
      </div>

      <p class="dim wx-note">
        ⚠️ 公众号正文不显示外链图片：「插入」适合博客/文档，公众号请点「下载」后到编辑器上传；封面用「封面」裁剪 2.35:1。
      </p>
    </template>

    <ImageCropDialog v-if="cropping" :image="cropping" @close="cropping = null" />
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
.img-scroll {
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

/* Key 配置态 */
.key-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.provider-row {
  display: flex;
  gap: 8px;
}
.provider-btn {
  flex: 1;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.provider-btn.active {
  border-color: #07c160;
  color: #07c160;
  background: #f0faf4;
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

/* 搜索态 */
.search-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.search-row input {
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
.search-row input:focus {
  border-color: #07c160;
}
.search-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
}
.search-btn:hover:not(:disabled) {
  border-color: #07c160;
}
.search-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.ai-kw {
  width: 100%;
  height: 28px;
  margin-bottom: 8px;
  border: 1px dashed #b9e6cb;
  border-radius: 7px;
  background: #f0faf4;
  color: #07c160;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ai-kw:hover:not(:disabled) {
  background: #e2f6ea;
}
.ai-kw:disabled {
  opacity: 0.6;
  cursor: default;
}
.kw-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.kw-chips button {
  border: 1px solid #e5e6eb;
  border-radius: 999px;
  background: #fff;
  color: #4e5969;
  font-size: 11.5px;
  padding: 3px 10px;
  cursor: pointer;
}
.kw-chips button:hover {
  border-color: #07c160;
  color: #07c160;
}
.img-error {
  font-size: 12.5px;
  color: #e5554e;
  line-height: 1.6;
}

/* 结果网格 */
.img-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.img-card {
  margin: 0;
  border: 1px solid #eef0f2;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.img-card img {
  display: block;
  width: 100%;
  height: 86px;
  object-fit: cover;
  cursor: pointer;
}
.img-card figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 4px 6px;
}
.author {
  font-size: 10px;
  color: #a8adb5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}
.ops {
  display: inline-flex;
  gap: 2px;
  flex-shrink: 0;
}
.ops button {
  border: none;
  background: transparent;
  color: #4e5969;
  font-size: 10.5px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}
.ops button:hover {
  background: #e8f9ef;
  color: #07c160;
}
.wx-note {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #e5e6eb;
}
</style>
