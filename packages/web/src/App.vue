<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  copyHtmlToClipboard,
  exportHtmlFile,
  exportPrintPdf,
  exportWordDoc,
  getTheme,
  withImportant,
} from '@typeduck/core'
import { DuckEditor, DuckPreview, DocumentList, ThemeSelector } from '@typeduck/shared-ui'
import { useEditorStore } from './stores/editor'
import HistoryPanel from './components/HistoryPanel.vue'

const store = useEditorStore()
const editorRef = ref<InstanceType<typeof DuckEditor>>()
const previewRef = ref<InstanceType<typeof DuckPreview>>()
const rightView = ref<'theme' | 'history'>('theme')
const viewMode = ref<'split' | 'editor' | 'preview'>('split')

/** 视图模式：双栏 / 仅编辑 / 仅预览（分段图标切换） */
const viewModes = [
  { mode: 'split', label: '双栏', icon: '<path d="M3 4h7v14H3zM12 4h7v14h-7z"/>' },
  { mode: 'editor', label: '仅编辑', icon: '<path d="M3 4h14v14H3z"/>' },
  { mode: 'preview', label: '仅预览', icon: '<path d="M5 4h8v14H5zM16 8l3 3-3 3"/>' },
] as const

onMounted(() => {
  store.load()
  setupSyncScroll()
  document.addEventListener('click', onDocClickForExport)
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

/** 文档列表数据：附带主题强调色圆点 */
function pickColor(style: string): string {
  const m = style.match(/(?:^|;)\s*color:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))/)
  return m ? m[1] : ''
}
const docsForList = computed(() =>
  store.docs.map((d) => {
    const t = getTheme(d.themeId)
    return {
      ...d,
      themeColor: pickColor(t.styles.h2) || pickColor(t.styles.root) || '#999999',
    }
  }),
)

/** 复制防重复：点击后短暂禁用并切换文案 */
const copied = ref(false)

/** 检测正文首个标题是否与文档标题重复（粘贴后读者会看到两个大标题） */
function detectTitleDuplicate(): boolean {
  const doc = store.activeDoc
  if (!doc || !doc.title.trim()) return false
  const heading = doc.content.match(/^#{1,3}\s+(.+)$/m)
  if (!heading) return false
  const strip = (s: string) => s.replace(/[#*`~>\[\]()!]/g, '').replace(/\s+/g, '').trim()
  return strip(heading[1]) === strip(doc.title)
}

async function onCopy() {
  if (copied.value) return
  const ok = await copyHtmlToClipboard(`<section style="${rootStyle.value}">${store.renderedHtml}</section>`)
  if (ok) {
    copied.value = true
    setTimeout(() => (copied.value = false), 800)
    if (detectTitleDuplicate()) {
      store.showToast('已复制 ⚠️ 正文首个标题与标题栏重复，读者会看到两个大标题，建议删掉正文里的 H1')
      return
    }
    store.showToast('已复制，去公众号编辑器粘贴吧！🦆')
    return
  }
  store.showToast('复制失败，请重试')
}

const charCount = computed(() => store.activeDoc?.content.length ?? 0)
const lineCount = computed(() => store.activeDoc?.content.split('\n').length ?? 0)

/** 标题输入框宽度 = 编辑器列宽度（编辑/预览各占一半，右侧面板 300px） */
const titleInputWidth = computed(() => {
  if (viewMode.value === 'editor') return 'calc(100% - 28px)'
  return 'calc((100% - 300px) / 2 - 28px)'
})

function onExport() {
  if (!store.activeDoc) return
  exportHtmlFile(
    store.activeDoc.title || '未命名文档',
    store.renderedRichHtml,
    store.theme.previewBackground,
    rootStyle.value,
    store.customCss,
  )
  store.showToast('已导出 HTML 文件')
}

/** 导出下拉 */
const showExportMenu = ref(false)
async function onExportAs(format: 'html' | 'markdown' | 'docx' | 'pdf') {
  showExportMenu.value = false
  if (!store.activeDoc) return
  const name = store.activeDoc.title || '未命名文档'
  if (format === 'html') return onExport()
  if (format === 'markdown') {
    const blob = new Blob([store.activeDoc.content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/[\\/:*?"<>|]/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
    store.showToast('已导出 Markdown 文件')
    return
  }
  if (format === 'docx') {
    // Word 不识别 !important，用干净版渲染产物
    await exportWordDoc(
      name,
      store.renderedHtmlPlain,
      store.theme.previewBackground,
      store.theme.styles.root,
    )
    store.showToast('已导出 Word (.docx)')
    return
  }
  // PDF：弹出打印窗口，选「另存为 PDF」
  exportPrintPdf(name, store.renderedRichHtml, store.theme.previewBackground, rootStyle.value, store.customCss)
  store.showToast('在打印窗口选择「另存为 PDF」')
}

/** 点击导出菜单外部关闭 */
function onDocClickForExport(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (showExportMenu.value && !el.closest('.export-wrap')) showExportMenu.value = false
}

async function onRemove(id: string) {
  if (confirm('确定删除该文档及其历史版本？此操作不可恢复。')) {
    await store.removeDoc(id)
  }
}
</script>

<template>
  <div class="app">
    <!-- 通栏顶栏：品牌 + 主操作（横贯整个窗口） -->
    <header class="appbar">
      <div class="brand">
        <span class="brand-logo">🦆</span>
        <span class="brand-name">排版鸭</span>
        <span class="brand-slogan">排版呀，交给我吧！</span>
      </div>
      <div class="appbar-right">
        <button class="copy-primary" :class="{ done: copied }" :disabled="copied" title="复制到公众号" @click="onCopy">
          <svg v-if="!copied" class="ic" viewBox="0 0 22 22" aria-hidden="true">
            <path d="M9 7l-4 4 4 4M13 7l4 4-4 4" />
          </svg>
          <span v-else class="check">✓</span>
          {{ copied ? '已复制' : '复制到公众号' }}
        </button>
        <!-- 导出下拉：HTML / Markdown 可用，DOCX / PDF 占位 -->
        <div class="export-wrap">
          <button class="btn-export" title="导出" @click.stop="showExportMenu = !showExportMenu">
            导出
            <span class="caret">▾</span>
          </button>
          <div v-if="showExportMenu" class="export-menu" @click.stop>
            <button class="export-item" @click="onExportAs('html')">导出为 HTML</button>
            <button class="export-item" @click="onExportAs('markdown')">导出为 Markdown</button>
            <button class="export-item" @click="onExportAs('docx')">导出为 Word (.docx)</button>
            <button class="export-item" @click="onExportAs('pdf')">导出为 PDF</button>
          </div>
        </div>
      </div>
    </header>

    <!-- 主体：侧栏与子标题栏同一行起步，工作区在右侧纵排 -->
    <div class="body">
      <aside class="sidebar">
        <DocumentList
          :docs="docsForList"
          :active-id="store.activeDoc?.id ?? null"
          @select="store.selectDoc"
          @create="store.createDoc"
          @remove="onRemove"
        />
      </aside>

      <div class="workarea">
        <!-- 子标题栏：与侧栏同一行（不通栏） -->
        <div class="subbar">
          <!-- 宽度与编辑器列对齐（扣掉子栏左右内边距 28px） -->
          <input
            v-model="title"
            class="title-input"
            :style="{ width: titleInputWidth }"
            placeholder="无标题文档"
          />
          <div class="subbar-right">
            <!-- 视图切换：三枚图标分段选择，当前项高亮 -->
            <div class="view-switch">
              <button
                v-for="v in viewModes"
                :key="v.mode"
                class="icon-btn"
                :class="{ active: viewMode === v.mode }"
                :title="v.label"
                @click="viewMode = v.mode"
              >
                <svg class="ic" viewBox="0 0 22 22" v-html="v.icon"></svg>
              </button>
            </div>
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

        <div class="content">
          <section v-show="viewMode !== 'preview'" class="pane editor-pane">
            <DuckEditor ref="editorRef" v-model="content" />
          </section>
          <section v-show="viewMode !== 'editor'" class="pane preview-pane">
            <DuckPreview
              ref="previewRef"
              :html="store.renderedRichHtml"
              :custom-css="store.customCss"
              :background="store.theme.previewBackground"
              :root-style="rootStyle"
              :theme-name="store.theme.name"
              :article-title="store.activeDoc?.title"
              :account-name="store.accountName"
              @update:account-name="store.accountName = $event"
              @open-theme="rightView = 'theme'"
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
      </div>
    </div>

    <footer class="status-bar">
      <span v-if="store.activeDoc" class="status-meta">
        Markdown · {{ lineCount }} 行 · {{ store.activeDoc.wordCount }} 字 ·
        {{ charCount }} 字符 · 约 {{ store.activeDoc.estimatedReadTime }} 分钟
      </span>
      <span v-else class="status-meta">暂无文档</span>
      <span class="status-save" :data-state="store.saveState">{{ saveLabel }}</span>
    </footer>

    <transition name="toast">
      <div v-if="store.toast" class="toast">{{ store.toast }}</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
/* 主体行：侧栏与工作区同一行，均从通栏顶栏下方开始 */
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.workarea {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sidebar {
  width: 220px;
  border-right: 1px solid #e5e6eb;
  background: #fff;
  flex-shrink: 0;
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
/* 导出下拉 */
.export-wrap {
  position: relative;
  flex-shrink: 0;
}
.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 6px;
  background: #fff;
  color: #4e5969;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.btn-export:hover {
  border-color: #07c160;
  color: #07c160;
}
.btn-export .caret {
  font-size: 9px;
}
.export-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 80;
  min-width: 190px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
}
.export-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
}
.export-item:hover {
  background: #f2f3f5;
}
.export-item.soon {
  color: #999;
  cursor: default;
}
.export-item.soon:hover {
  background: #fafafa;
}
.export-item em {
  font-style: normal;
  font-size: 10px;
  color: #bbb;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 1px 5px;
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
.copy-primary:disabled {
  cursor: default;
}
.copy-primary.done {
  background: #37c700;
}
.copy-primary .check {
  font-size: 14px;
  font-weight: 700;
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
  max-width: 100%;
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
/* 视图切换分段组：三枚连体按钮 */
.view-switch {
  display: inline-flex;
  margin-right: 4px;
}
.view-switch .icon-btn {
  border-radius: 0;
  border-right-width: 0;
}
.view-switch .icon-btn:first-child {
  border-radius: 7px 0 0 7px;
}
.view-switch .icon-btn:last-child {
  border-radius: 0 7px 7px 0;
  border-right-width: 1px;
}
.view-switch .icon-btn.active {
  border-color: #07c160;
}
.view-switch .icon-btn.active + .icon-btn {
  border-left-color: #07c160;
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
  bottom: 60px; /* 避开底部状态栏 */
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
