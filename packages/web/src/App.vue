<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { copyHtmlToClipboard, exportHtmlFile } from '@typeduck/core'
import {
  DuckEditor,
  DuckPreview,
  DuckToolbar,
  DocumentList,
  ThemeSelector,
} from '@typeduck/shared-ui'
import { useEditorStore } from './stores/editor'
import HistoryPanel from './components/HistoryPanel.vue'

const store = useEditorStore()
const editorRef = ref<InstanceType<typeof DuckEditor>>()
const previewRef = ref<InstanceType<typeof DuckPreview>>()
const showThemePanel = ref(true)
const showHistory = ref(false)
const viewMode = ref<'split' | 'editor' | 'preview'>('split')

onMounted(() => {
  store.load()
  setupSyncScroll()
  // 桌面版：接住原生菜单事件
  if (window.desktopAPI) {
    const api = window.desktopAPI
    api.onMenu('menu:new', () => store.createDoc())
    api.onMenu('menu:open', () => store.openFromDisk())
    api.onMenu('menu:save', () => store.saveToDisk())
    api.onMenu('menu:save-as', () => store.saveToDisk(true))
  }
})

/** 双栏按比例同步滚动（加锁防回环，rAF 防抖） */
function setupSyncScroll() {
  let lock = false
  const sync = (from: HTMLElement, to: HTMLElement) => {
    if (lock) return
    lock = true
    requestAnimationFrame(() => {
      const fromMax = from.scrollHeight - from.clientHeight
      const toMax = to.scrollHeight - to.clientHeight
      if (fromMax > 0 && toMax > 0) {
        to.scrollTop = (from.scrollTop / fromMax) * toMax
      }
      lock = false
    })
  }
  const attach = () => {
    const editorEl = editorRef.value?.getScrollEl()
    const previewEl = previewRef.value?.getScrollEl()
    if (!editorEl || !previewEl) return false
    editorEl.addEventListener('scroll', () => sync(editorEl, previewEl), { passive: true })
    previewEl.addEventListener('scroll', () => sync(previewEl, editorEl), { passive: true })
    return true
  }
  // CodeMirror 的滚动容器在挂载后才存在，重试一次
  if (!attach()) setTimeout(attach, 500)
}

const content = computed({
  get: () => store.activeDoc?.content ?? '',
  set: (value: string) => {
    if (store.activeDoc) {
      store.activeDoc.content = value
      store.markUnsaved()
    }
  },
})

const title = computed({
  get: () => store.activeDoc?.title ?? '',
  set: (value: string) => {
    if (store.activeDoc) {
      store.activeDoc.title = value
      store.markUnsaved()
    }
  },
})

const themeId = computed({
  get: () => store.activeDoc?.themeId ?? 'minimal-white',
  set: (id: string) => {
    if (store.activeDoc) {
      store.activeDoc.themeId = id
      store.markUnsaved()
    }
  },
})

const saveLabel = computed(
  () =>
    ({ saved: '已保存', saving: '保存中…', unsaved: '未保存' })[store.saveState],
)

const charCount = computed(() => store.activeDoc?.content.length ?? 0)

function onInsert(text: string) {
  editorRef.value?.insert(text)
}
function onWrap(prefix: string, suffix: string) {
  editorRef.value?.wrapSelection(prefix, suffix)
}

async function onCopy() {
  const ok = await copyHtmlToClipboard(`<section style="${store.theme.styles.root}">${store.renderedHtml}</section>`)
  store.showToast(ok ? '已复制，去公众号编辑器粘贴吧！🦆' : '复制失败，请重试')
}

function onExport() {
  if (!store.activeDoc) return
  exportHtmlFile(
    store.activeDoc.title || '未命名文档',
    store.renderedHtml,
    store.theme.previewBackground,
    store.theme.styles.root,
  )
  store.showToast('已导出 HTML 文件')
}

async function onRemove(id: string) {
  if (confirm('确定删除该文档及其历史版本？此操作不可恢复。')) {
    await store.removeDoc(id)
  }
}

function setView(mode: 'split' | 'editor' | 'preview') {
  viewMode.value = mode
}
</script>

<template>
  <div class="app">
    <aside class="sidebar">
      <DocumentList
        :docs="store.docs"
        :active-id="store.activeDoc?.id ?? null"
        @select="store.selectDoc"
        @create="store.createDoc"
        @remove="onRemove"
      />
    </aside>

    <main class="main">
      <header class="title-bar">
        <div class="brand">
          <span class="brand-logo">🦆</span>
          <span class="brand-name">排版鸭</span>
        </div>
        <input v-model="title" class="title-input" placeholder="无标题文档" />
        <button class="copy-primary" title="复制到公众号" @click="onCopy">
          <svg class="ic" viewBox="0 0 22 22" aria-hidden="true">
            <path d="M9 7l-4 4 4 4M13 7l4 4-4 4" />
          </svg>
          复制到公众号
        </button>
      </header>

      <DuckToolbar
        @insert="onInsert"
        @wrap="onWrap"
        @export="onExport"
        @toggle-theme="showThemePanel = !showThemePanel"
        @toggle-history="showHistory = !showHistory"
        @set-view="setView"
      />

      <div class="panes">
        <div v-show="viewMode !== 'preview'" class="pane editor-pane">
          <DuckEditor ref="editorRef" v-model="content" />
        </div>
        <div v-show="viewMode !== 'editor'" class="pane preview-pane">
          <DuckPreview
            ref="previewRef"
            :html="store.renderedHtml"
            :background="store.theme.previewBackground"
            :root-style="store.theme.styles.root"
          />
        </div>
        <aside v-if="showThemePanel" class="theme-panel">
          <ThemeSelector v-model="themeId" />
        </aside>
        <HistoryPanel
          v-if="showHistory"
          :history="store.history"
          @restore="store.restoreHistory"
          @close="showHistory = false"
        />
      </div>

      <footer class="status-bar">
        <span v-if="store.activeDoc" class="status-meta">
          {{ store.activeDoc.wordCount }} 字 · {{ charCount }} 字符 · 约
          {{ store.activeDoc.estimatedReadTime }} 分钟
        </span>
        <span v-else class="status-meta">暂无文档</span>
        <span class="status-save" :data-state="store.saveState">{{ saveLabel }}</span>
      </footer>
    </main>

    <transition name="toast">
      <div v-if="store.toast" class="toast">{{ store.toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  height: 100%;
}
.sidebar {
  width: 220px;
  border-right: 1px solid #e5e6eb;
  background: #fff;
  flex-shrink: 0;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.title-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
.brand {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.brand-logo {
  font-size: 18px;
}
.brand-name {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}
.title-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 15px;
  font-weight: 600;
  background: transparent;
  min-width: 0;
}
.copy-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 6px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}
.copy-primary:hover {
  background: #06ad56;
}
.copy-primary .ic {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
}
.panes {
  flex: 1;
  display: flex;
  min-height: 0;
}
.pane {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.editor-pane {
  border-right: 1px solid #e5e6eb;
}
.theme-panel {
  width: 220px;
  border-left: 1px solid #e5e6eb;
  background: #fff;
  overflow-y: auto;
  flex-shrink: 0;
}
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 16px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
}
.status-save {
  color: #999;
}
.status-save[data-state='unsaved'] {
  color: #e6a23c;
}
.status-save[data-state='saving'] {
  color: #409eff;
}
.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 100;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
}
</style>
