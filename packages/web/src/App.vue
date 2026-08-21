<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AI_ACTIONS,
  buildMessages,
  compileAiTheme,
  copyHtmlToClipboard,
  exportHtmlFile,
  exportPrintPdf,
  exportWordDoc,
  extractAiTokens,
  getTheme,
  loadSavedAiThemes,
  parseTitles,
  persistAiTheme,
  registerTheme,
  removeSavedAiTheme,
  streamChat,
  unregisterTheme,
  withImportant,
} from '@typeduck/core'
import type { ActionInput, AiActionId, AiThemeTemplate } from '@typeduck/core'
import { DuckEditor, DuckPreview, DocumentList, ThemeSelector } from '@typeduck/shared-ui'
import { useEditorStore } from './stores/editor'
import { useAiStore, type AiTask } from './stores/ai'
import { fetchText } from './utils/net'
import { extractArticle } from './utils/article'
import HistoryPanel from './components/HistoryPanel.vue'
import AiPanel from './components/AiPanel.vue'
import AiSettings from './components/AiSettings.vue'
import HotPanel from './components/HotPanel.vue'
import ImagePanel from './components/ImagePanel.vue'

const store = useEditorStore()
const aiStore = useAiStore()
const editorRef = ref<InstanceType<typeof DuckEditor>>()
const previewRef = ref<InstanceType<typeof DuckPreview>>()
const rightView = ref<'theme' | 'history' | 'ai' | 'hot' | 'image' | null>('theme')

/** 右侧面板按钮：再次点击已激活的面板则整体收起（编辑区自动变宽） */
function toggleRightView(view: 'theme' | 'history' | 'ai' | 'hot' | 'image') {
  rightView.value = rightView.value === view ? null : view
}
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
  // 恢复上次保存的 AI 生成主题（localStorage → 运行时注册）
  loadSavedAiThemes().forEach(registerTheme)
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

/** 标题输入框宽度 = 编辑器列宽度 − ✨ 按钮（32px）− 间距（12px）− 内边距（28px）；面板收起时编辑列变宽 */
const titleInputWidth = computed(() => {
  if (viewMode.value === 'editor') return 'calc(100% - 72px)'
  const panel = rightView.value ? 300 : 0
  return `calc((100% - ${panel}px) / 2 - 72px)`
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

/* ---------- AI 辅助写作（BYOK，一套 OpenAI 兼容协议接所有厂商） ---------- */

const showAiSettings = ref(false)
const aiTask = ref<AiTask | null>(null)
let aiAbort: AbortController | undefined

/** 未配置时弹设置 + 提示，已配置返回 true */
function ensureAiReady(): boolean {
  if (aiStore.isConfigured) return true
  showAiSettings.value = true
  store.showToast('先配置 AI：选厂商、填你自己的 API Key')
  return false
}

/** 编辑器工具栏 AI 按钮：润色 / 扩写 / 缩写 / 续写 */
function onAiAction(action: AiActionId) {
  if (!ensureAiReady()) return
  const info = editorRef.value?.getSelectionInfo()
  if (!info) return
  if (AI_ACTIONS[action].needsSelection && !info.text.trim()) {
    store.showToast('请先选中要处理的文字')
    return
  }
  runAiTask(
    action,
    { selection: info.text, before: info.before },
    info.text.trim() ? { from: info.from, to: info.to } : null,
  )
}

/** 子标题栏 ✨：基于正文生成 5 个候选标题 */
function onGenerateTitles() {
  if (!ensureAiReady()) return
  const doc = store.activeDoc
  if (!doc || doc.content.trim().length < 50) {
    store.showToast('先写点正文，再来生成标题')
    return
  }
  runAiTask('titles', { before: doc.content, title: doc.title }, null)
}

/** AI 面板：自定义指令（作用于当前选区） */
function onAiCustom(instruction: string) {
  if (!ensureAiReady()) return
  const info = editorRef.value?.getSelectionInfo()
  if (!info || !info.text.trim()) {
    store.showToast('请先在编辑器中选中要处理的文字')
    return
  }
  runAiTask('custom', { selection: info.text, instruction }, { from: info.from, to: info.to })
}

function onAiOutline(topic: string, style: string) {
  if (!ensureAiReady()) return
  runAiTask('outline', { topic, style }, null)
}

function onAiDigest() {
  if (!ensureAiReady()) return
  const doc = store.activeDoc
  if (!doc || doc.content.trim().length < 50) {
    store.showToast('先写点正文，再来生成摘要')
    return
  }
  runAiTask('digest', { before: doc.content, title: doc.title }, null)
}

function onAiThemeGen(description: string, template: string) {
  if (!ensureAiReady()) return
  runAiTask('theme', { description, template }, null)
}

async function runAiTask(action: AiActionId, input: ActionInput, range: AiTask['range']) {
  if (!store.activeDoc) return
  aiAbort?.abort()
  aiAbort = new AbortController()
  rightView.value = 'ai'
  const docId = store.activeDoc.id
  aiTask.value = { docId, action, status: 'streaming', text: '', input, range }
  try {
    const full = await streamChat(aiStore.config, buildMessages(action, input), {
      signal: aiAbort.signal,
      onDelta: (t) => aiTask.value && (aiTask.value.text += t),
    })
    if (!aiTask.value || aiTask.value.docId !== docId) return
    if (action === 'titles' && parseTitles(full).length === 0) {
      aiTask.value.status = 'error'
      aiTask.value.text = '模型没有按格式返回标题，点「重试」或换个模型'
      return
    }
    if (action === 'theme') {
      const tokens = extractAiTokens(full)
      if (!tokens) {
        aiTask.value.status = 'error'
        aiTask.value.text = '未能解析出主题设计令牌，点「重试」或换个模型'
        return
      }
      aiTask.value.theme = compileAiTheme(tokens, (input.template as AiThemeTemplate) ?? 'clean')
    }
    aiTask.value.status = 'done'
  } catch (err) {
    if (!aiTask.value || aiTask.value.docId !== docId) return
    if ((err as Error).name === 'AbortError') {
      // 手动停止：已有部分内容按完成处理，否则收起任务
      if (aiTask.value.text) aiTask.value.status = 'done'
      else aiTask.value = null
    } else {
      aiTask.value.status = 'error'
      aiTask.value.text = err instanceof Error ? err.message : String(err)
    }
  }
}

/** 结果回写编辑器：替换当时的选区，或插入到光标处 */
function onAiApply(mode: 'replace' | 'insert') {
  const task = aiTask.value
  if (!task || task.status !== 'done') return
  if (store.activeDoc?.id !== task.docId) {
    store.showToast('文档已切换，请重新生成')
    return
  }
  if (mode === 'replace' && task.range) {
    editorRef.value?.replaceRange(task.range.from, task.range.to, task.text)
  } else {
    editorRef.value?.insert(task.text)
  }
  aiTask.value = null
  store.showToast('已写入编辑器')
}

function onAiUseTitle(title: string) {
  if (!store.activeDoc) return
  store.activeDoc.title = title
  store.markUnsaved()
  aiTask.value = null
  store.showToast('标题已应用 ✨')
}

function onAiRetry() {
  const task = aiTask.value
  if (task) runAiTask(task.action, task.input, task.range)
}

/* ---------- 链接改写：抓取原文 → 提取正文 → 新建文档（带出处）→ AI 流式改写 ---------- */

async function doRewrite(url: string, title?: string, instruction?: string) {
  if (!ensureAiReady()) return
  if (!/^https?:\/\//.test(url)) {
    store.showToast('请输入以 http(s):// 开头的文章链接')
    return
  }
  store.showToast('正在抓取原文…')
  let html: string
  try {
    html = await fetchText(url)
  } catch {
    store.showToast('抓取失败：站点拒绝访问或跨域受限（桌面版更稳），也可复制正文后用「自定义指令」改写')
    return
  }
  const article = extractArticle(html, url)
  if (article.text.length < 120) {
    store.showToast('未能提取正文（该站可能需要 JS 渲染），可复制正文后用「自定义指令」改写')
    return
  }
  const source = article.title || title || url
  await store.createDoc(`> 原文：[${source}](${url})\n\n`)
  runAiTask('rewrite', { selection: article.text, title: source, instruction }, null)
}

/** 热点条目「AI 改写」 */
function onHotRewrite(item: { title: string; url: string }) {
  doRewrite(item.url, item.title)
}

/** AI 面板「链接改写」表单 */
function onRewriteUrl(url: string, instruction: string) {
  doRewrite(url, undefined, instruction || undefined)
}

/** AI 主题：注册 + 持久化 + 应用到当前文档 */
function onAiSaveTheme() {
  const theme = aiTask.value?.theme
  if (!theme || !store.activeDoc) return
  registerTheme(theme)
  persistAiTheme(theme)
  store.activeDoc.themeId = theme.id
  store.markUnsaved()
  aiTask.value = null
  store.showToast(`主题「${theme.name}」已保存并应用 🎨`)
  // 面板切走再切回会重新挂载主题列表，新主题立即可见
  rightView.value = 'theme'
}

function onAiDiscard() {
  aiTask.value = null
}

/** 删除 AI 生成主题（内置主题不受影响） */
function onRemoveTheme(id: string) {
  removeSavedAiTheme(id)
  unregisterTheme(id)
  if (store.activeDoc?.themeId === id) {
    store.activeDoc.themeId = 'minimal-white'
    store.markUnsaved()
  }
  store.showToast('已删除该 AI 主题')
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
          <!-- 宽度与编辑器列对齐（扣掉左右内边距 28px + ✨ 按钮 32px + 间距 12px） -->
          <input
            v-model="title"
            class="title-input"
            :style="{ width: titleInputWidth }"
            placeholder="无标题文档"
          />
          <button class="icon-btn" title="AI 生成标题" @click="onGenerateTitles">
            <svg class="ic" viewBox="0 0 22 22">
              <path
                d="M11 3l1.7 4.5L17 9l-4.3 1.5L11 15l-1.7-4.5L5 9l4.3-1.5zM17.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"
              />
            </svg>
          </button>
          <div class="subbar-right">
            <!-- AI 助手面板 -->
            <button
              class="icon-btn"
              :class="{ active: rightView === 'ai' }"
              title="AI 助手"
              @click="toggleRightView('ai')"
            >
              <svg class="ic" viewBox="0 0 22 22">
                <path d="M4 5h14v10H9l-5 4zM8 10h.01M12 10h.01M16 10h.01" />
              </svg>
            </button>
            <!-- 热点选题面板 -->
            <button
              class="icon-btn"
              :class="{ active: rightView === 'hot' }"
              title="热点选题"
              @click="toggleRightView('hot')"
            >
              <svg class="ic" viewBox="0 0 22 22">
                <path
                  d="M12 3c2 2.5-.5 4.5-.5 6.5 0 1.2.9 2 2 2s2-.8 2-2C17 11 18 12.8 18 15a6 6 0 0 1-12 0c0-3.5 3-5 4.5-8C11.3 5.7 11.5 4.4 12 3z"
                />
              </svg>
            </button>
            <!-- 配图助手面板 -->
            <button
              class="icon-btn"
              :class="{ active: rightView === 'image' }"
              title="配图助手"
              @click="toggleRightView('image')"
            >
              <svg class="ic" viewBox="0 0 22 22">
                <path d="M3 5h16v12H3zM3 14l4-4 3 3 3-4 6 6" />
                <circle cx="8" cy="8.5" r="1.4" />
              </svg>
            </button>
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
              @click="toggleRightView('history')"
            >
              <svg class="ic" viewBox="0 0 22 22">
                <path d="M3 11a8 8 0 1 0 3-6M3 4v4h4M11 7v4l3 2" />
              </svg>
            </button>
            <button
              class="icon-btn"
              :class="{ active: rightView === 'theme' }"
              title="主题样式"
              @click="toggleRightView('theme')"
            >
              <svg class="ic" viewBox="0 0 22 22">
                <path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 1 0-16z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="content">
          <section v-show="viewMode !== 'preview'" class="pane editor-pane">
            <DuckEditor ref="editorRef" v-model="content" @ai="onAiAction" />
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
          <aside v-if="rightView" class="pane right-pane">
            <template v-if="rightView === 'theme'">
              <div class="panel-head"><span>主题样式</span></div>
              <div class="right-scroll">
                <ThemeSelector v-model="themeId" @remove-theme="onRemoveTheme" />
              </div>
            </template>
            <AiPanel
              v-else-if="rightView === 'ai'"
              :task="aiTask"
              @stop="aiAbort?.abort()"
              @retry="onAiRetry"
              @apply="onAiApply"
              @use-title="onAiUseTitle"
              @close="rightView = null"
              @open-settings="showAiSettings = true"
              @run-custom="onAiCustom"
              @run-outline="onAiOutline"
              @run-digest="onAiDigest"
              @run-theme="onAiThemeGen"
              @run-rewrite="onRewriteUrl"
              @save-theme="onAiSaveTheme"
              @discard="onAiDiscard"
            />
            <HotPanel v-else-if="rightView === 'hot'" @close="rightView = null" @rewrite="onHotRewrite" />
            <ImagePanel
              v-else-if="rightView === 'image'"
              @close="rightView = null"
              @insert="(md: string) => editorRef?.insert(md)"
            />
            <HistoryPanel
              v-else
              :history="store.history"
              @restore="store.restoreHistory"
              @close="rightView = null"
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

    <AiSettings v-if="showAiSettings" @close="showAiSettings = false" />

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
