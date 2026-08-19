<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { copyHtmlToClipboard, exportHtmlFile, withImportant } from '@typeduck/core'
import { DuckEditor, DuckPreview, DocumentList, ThemeSelector } from '@typeduck/shared-ui'
import { useEditorStore } from './stores/editor'
import HistoryPanel from './components/HistoryPanel.vue'

const store = useEditorStore()
const editorRef = ref<InstanceType<typeof DuckEditor>>()
const previewRef = ref<InstanceType<typeof DuckPreview>>()
const rightView = ref<'theme' | 'history'>('theme')
const viewMode = ref<'split' | 'editor' | 'preview'>('split')

const viewLabels: Record<typeof viewMode.value, string> = {
  split: '双栏',
  editor: '仅编辑',
  preview: '仅预览',
}
const viewTitle = computed(() => `视图切换（当前：${viewLabels[viewMode.value]}）`)

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

/** 根容器样式同样加 !important，防公众号编辑器覆盖 */
const rootStyle = computed(() => withImportant(store.theme.styles.root))

const charCount = computed(() => store.activeDoc?.content.length ?? 0)
const lineCount = computed(() => store.activeDoc?.content.split('\n').length ?? 0)

async function onCopy() {
  const ok = await copyHtmlToClipboard(`<section style="${rootStyle.value}">${store.renderedHtml}</section>`)
  store.showToast(ok ? '已复制，去公众号编辑器粘贴吧！🦆' : '复制失败，请重试')
}

function onPublish() {
  store.showToast('发布到公众号需配置已认证服务号 API，敬请期待 🚀')
}

function onExport() {
  if (!store.activeDoc) return
  exportHtmlFile(
    store.activeDoc.title || '未命名文档',
    store.renderedHtml,
    store.theme.previewBackground,
    rootStyle.value,
  )
  store.showToast('已导出 HTML 文件')
}

async function onRemove(id: string) {
  if (confirm('确定删除该文档及其历史版本？此操作不可恢复。')) {
    await store.removeDoc(id)
  }
}

function cycleView() {
  viewMode.value =
    viewMode.value === 'split' ? 'editor' : viewMode.value === 'editor' ? 'preview' : 'split'
}
</script>

<template>
  <div class="app">
    <!-- 左侧文档列表 -->
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
      <!-- 顶栏：品牌 + 主操作 -->
      <header class="appbar">
        <div class="brand">
          <span class="brand-logo">🦆</span>
          <span class="brand-name">排版鸭</span>
          <span class="brand-slogan">排版呀，交给我吧！</span>
        </div>
        <div class="appbar-right">
          <button class="btn-publish" title="发布到公众号" @click="onPublish">发布到公众号</button>
          <button class="copy-primary" title="复制到公众号" @click="onCopy">
            <svg class="ic" viewBox="0 0 22 22" aria-hidden="true">
              <path d="M9 7l-4 4 4 4M13 7l4 4-4 4" />
            </svg>
            复制到公众号
          </button>
        </div>
      </header>

      <!-- 子标题栏：标题输入 + 保存状态 + 视图/导出/历史/主题图标 -->
      <div class="subbar">
        <input v-model="title" class="title-input" placeholder="无标题文档" />
        <span class="save-state" :data-state="store.saveState">{{ saveLabel }}</span>
        <div class="subbar-right">
          <button class="icon-btn" :title="viewTitle" @click="cycleView">
            <svg class="ic" viewBox="0 0 22 22">
              <path d="M3 4h7v14H3zM12 4h7v14h-7z" />
            </svg>
          </button>
          <button class="icon-btn" title="导出 HTML" @click="onExport">
            <svg class="ic" viewBox="0 0 22 22">
              <path d="M11 3v9M8 9l3 3 3-3M4 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
            </svg>
          </button>
          <button
            class="icon-btn"
            :class="{ active: rightView === 'history' }"
            title="历史版本"
            @click="rightView = 'history'"
          >
            <svg class="ic" viewBox="0 0 22 22">
              <path d="M3 11a8 8 0 1 0 3-6M3 4v4h4M11 7v4l3 2" />
            </svg>
          </button>
          <button
            class="icon-btn"
            :class="{ active: rightView === 'theme' }"
            title="主题样式"
            @click="rightView = 'theme'"
          >
            <svg class="ic" viewBox="0 0 22 22">
              <path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 1 0-16z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 内容区：编辑 / 预览 / 右侧面板（3 列） -->
      <div class="content">
        <section v-show="viewMode !== 'preview'" class="pane editor-pane">
          <DuckEditor ref="editorRef" v-model="content" />
        </section>
        <section v-show="viewMode !== 'editor'" class="pane preview-pane">
          <DuckPreview
            ref="previewRef"
            :html="store.renderedHtml"
            :background="store.theme.previewBackground"
            :root-style="rootStyle"
          />
        </section>
        <aside class="pane right-pane">
          <template v-if="rightView === 'theme'">
            <div class="panel-head"><span>主题样式</span></div>
            <div class="right-scroll">
              <ThemeSelector v-model="themeId" />
            </div>
          </template>
          <HistoryPanel
            v-else
            :history="store.history"
            @restore="store.restoreHistory"
            @close="rightView = 'theme'"
          />
        </aside>
      </div>

      <footer class="status-bar">
        <span v-if="store.activeDoc" class="status-meta">
          Markdown · {{ lineCount }} 行 · {{ store.activeDoc.wordCount }} 字 ·
          {{ charCount }} 字符 · 约 {{ store.activeDoc.estimatedReadTime }} 分钟
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

/* 顶栏 */
.appbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  flex-shrink: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}
.brand-logo {
  font-size: 18px;
  line-height: 1;
}
.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
}
.brand-slogan {
  font-size: 12px;
  color: #b0b3b8;
  white-space: nowrap;
}
.appbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-publish {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: 1px solid #07c160;
  border-radius: 6px;
  background: #fff;
  color: #07c160;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.btn-publish:hover {
  background: #e8f9ef;
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

/* 子标题栏 */
.subbar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  flex-shrink: 0;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
.title-input {
  width: 260px;
  max-width: 40%;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  transition: border-color 0.15s ease;
}
.title-input:focus {
  border-color: #07c160;
}
.save-state {
  font-size: 12px;
  color: #07c160;
  white-space: nowrap;
  flex-shrink: 0;
}
.save-state[data-state='unsaved'] {
  color: #e6a23c;
}
.save-state[data-state='saving'] {
  color: #409eff;
}
.subbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.icon-btn:hover {
  background: #f2f3f5;
  color: #1d2129;
}
.icon-btn.active {
  background: #e8f9ef;
  color: #07c160;
  border-color: #07c160;
}
.icon-btn .ic {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 内容区 3 列 */
.content {
  flex: 1;
  display: flex;
  min-height: 0;
}
.pane {
  min-width: 0;
  overflow: hidden;
}
.editor-pane {
  flex: 1.1;
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
}
.preview-pane {
  flex: 1.1;
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}
.right-pane {
  flex: 0 0 300px;
  width: 300px;
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.right-scroll {
  flex: 1;
  overflow-y: auto;
}

/* 底部状态栏 */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  flex-shrink: 0;
  padding: 0 16px;
  border-top: 1px solid #e5e6eb;
  background: #fafafa;
  font-size: 12px;
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
