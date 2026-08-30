<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  AI_ACTIONS,
  buildMessages,
  checkWechatCompatibility,
  compileAiTheme,
  copyHtmlToClipboard,
  exportHtmlFile,
  exportPrintPdf,
  exportWordDoc,
  extractAiTokens,
  getTheme,
  isHtmlContent,
  loadSavedAiThemes,
  parseTitles,
  persistAiTheme,
  registerTheme,
  removeSavedAiTheme,
  streamChat,
  toWechatHtml,
  unregisterTheme,
  WECHAT_ARTICLE_CSS,
  withImportant,
} from '@typeduck/core'
import type { ActionInput, AiActionId, AiThemeTemplate } from '@typeduck/core'
import { DuckEditor, DuckPreview, DocumentList, ThemeSelector } from '@typeduck/shared-ui'
import { useEditorStore } from './stores/editor'
import { useAiStore, type AiTask } from './stores/ai'
import { fetchText } from './utils/net'
import { extractArticle } from './utils/article'
import { insertImage, hydrateTdimgs, resolveTdimgs } from './utils/images'
import HistoryPanel from './components/HistoryPanel.vue'
import AiPanel from './components/AiPanel.vue'
import HotPanel from './components/HotPanel.vue'
import ImagePanel from './components/ImagePanel.vue'
import ReferencePanel from './components/ReferencePanel.vue'
import PublishDialog from './components/PublishDialog.vue'
import OssSettings from './components/OssSettings.vue'
import SettingsCenter from './components/SettingsCenter.vue'

const store = useEditorStore()
const aiStore = useAiStore()
const editorRef = ref<InstanceType<typeof DuckEditor>>()
const previewRef = ref<InstanceType<typeof DuckPreview>>()
const aiPanelRef = ref<InstanceType<typeof AiPanel>>()
const rightView = ref<'theme' | 'history' | 'ai' | 'hot' | 'image' | null>('theme')
const showSettings = ref(false)
const settingsSection = ref<string>('overview')

/** 右侧面板按钮：再次点击已激活的面板则整体收起（编辑区自动变宽） */
function toggleRightView(view: 'theme' | 'history' | 'ai' | 'hot' | 'image') {
  rightView.value = rightView.value === view ? null : view
}

/** 工具区折叠图标：记住最近打开的面板，收起后可一键还原 */
const lastRightView = ref<'theme' | 'history' | 'ai' | 'hot' | 'image'>('theme')
watch(rightView, (v) => { if (v) lastRightView.value = v })
function toggleRightPane() {
  rightView.value = rightView.value ? null : lastRightView.value
}
/** 读取偏好设置（SettingsCenter 保存到 localStorage） */
function getPrefs(): { defaultView: string; syncScroll: boolean; compactSidebar: boolean } {
  try {
    const raw = localStorage.getItem('typeduck:preferences')
    if (raw) return { defaultView: 'split', syncScroll: true, compactSidebar: false, ...JSON.parse(raw) }
  } catch { /* 忽略 */ }
  return { defaultView: 'split', syncScroll: true, compactSidebar: false }
}

const viewMode = ref<'all' | 'refedit' | 'refprev' | 'split' | 'editor' | 'preview'>(
  (['all', 'refedit', 'refprev', 'split', 'editor', 'preview'] as const).includes(getPrefs().defaultView as any)
    ? (getPrefs().defaultView as 'all' | 'refedit' | 'refprev' | 'split' | 'editor' | 'preview')
    : 'split',
)

/** 参考文面板是否可见（三栏 / 浏览+编辑 / 浏览+预览） */
const refVisible = computed(
  () => viewMode.value === 'all' || viewMode.value === 'refedit' || viewMode.value === 'refprev',
)

/** 侧栏文档列表折叠状态（localStorage 持久化） */
const sidebarCollapsed = ref(localStorage.getItem('typeduck:sidebarCollapsed') === '1')
watch(sidebarCollapsed, (v) => localStorage.setItem('typeduck:sidebarCollapsed', v ? '1' : '0'))

/** 双栏分割宽度：默认跟随 flex 比例，拖拽后记忆像素宽度（localStorage 持久化） */
const editorWidth = ref<number | null>(null)
const editorPaneRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
onMounted(() => {
  const saved = Number(localStorage.getItem('typeduck:editorWidth'))
  if (Number.isFinite(saved) && saved >= 220) editorWidth.value = saved
})
/** 拖拽分割条：窗口级监听移动/松开，宽度限制在 220px ~ 容器-260px 之间（三栏时扣除参考文宽度） */
function onSplitDragStart(e: MouseEvent) {
  const pane = editorPaneRef.value
  if (!pane) return
  e.preventDefault()
  const startX = e.clientX
  const startW = pane.getBoundingClientRect().width
  const refW = refPaneRef.value?.offsetWidth ?? 0
  const maxW = Math.max((contentRef.value?.clientWidth ?? 0) - refW - 260, 260)
  const onMove = (ev: MouseEvent) => {
    editorWidth.value = Math.min(Math.max(startW + (ev.clientX - startX), 220), maxW)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('resizing')
    localStorage.setItem('typeduck:editorWidth', String(Math.round(editorWidth.value ?? 0)))
  }
  document.body.classList.add('resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 参考文面板宽度：可拖拽调整，宽度限制在 200px ~ 容器-480px 之间（localStorage 持久化） */
const refWidth = ref<number | null>(null)
const refPaneRef = ref<HTMLElement>()
onMounted(() => {
  const saved = Number(localStorage.getItem('typeduck:refWidth'))
  if (Number.isFinite(saved) && saved >= 200) refWidth.value = saved
})
function onRefDragStart(e: MouseEvent) {
  const pane = refPaneRef.value
  if (!pane) return
  e.preventDefault()
  const startX = e.clientX
  const startW = pane.getBoundingClientRect().width
  const maxW = Math.max((contentRef.value?.clientWidth ?? 0) - 480, 200)
  const onMove = (ev: MouseEvent) => {
    refWidth.value = Math.min(Math.max(startW + (ev.clientX - startX), 200), maxW)
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    document.body.classList.remove('resizing')
    localStorage.setItem('typeduck:refWidth', String(Math.round(refWidth.value ?? 0)))
  }
  document.body.classList.add('resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

/** 顶栏品牌点击回静态首页 */
function goHome() {
  location.href = 'index.html'
}

/** 视图模式：三栏 / 浏览+编辑 / 浏览+预览 / 编辑+预览 / 仅编辑 / 仅预览（胶囊分段切换） */
const viewModes = [
  { mode: 'all', label: '三栏' },
  { mode: 'refedit', label: '浏览+编辑' },
  { mode: 'refprev', label: '浏览+预览' },
  { mode: 'split', label: '编辑+预览' },
  { mode: 'editor', label: '仅编辑' },
  { mode: 'preview', label: '仅预览' },
] as const

const toolViews = [
  { id: 'theme', label: '排版' },
  { id: 'ai', label: 'AI 创作' },
  { id: 'hot', label: '热点' },
  { id: 'image', label: '素材' },
  { id: 'history', label: '版本' },
] as const

onMounted(async () => {
  await store.load()
  setupSyncScroll()
  document.addEventListener('click', onDocClickForExport)
  // 恢复上次保存的 AI 生成主题（localStorage → 运行时注册）
  loadSavedAiThemes().forEach(registerTheme)
  // 恢复文档里的本地图片引用（tdimg → blob URL，供预览）——必须在 load 之后
  await hydrateTdimgs(store.activeDoc?.content ?? '')
  // 桌面版：接住原生菜单事件
  if (window.desktopAPI) {
    const api = window.desktopAPI
    api.onMenu('menu:new', () => store.createDoc())
    api.onMenu('menu:open', () => store.openFromDisk())
    api.onMenu('menu:save', () => store.saveToDisk())
    api.onMenu('menu:save-as', () => store.saveToDisk(true))
  }
})

/** 切换文档时重新恢复该文档的本地图片引用 */
watch(
  () => store.activeDoc?.id,
  () => { hydrateTdimgs(store.activeDoc?.content ?? '') },
)

/** 偏好设置变化时实时生效（SettingsCenter 保存后 dispatch 通知） */
function applyPrefs(prefs: { syncScroll?: boolean; compactSidebar?: boolean }) {
  syncScrollEnabled = prefs.syncScroll !== false
  document.querySelector('.sidebar')?.classList.toggle('compact', prefs.compactSidebar === true)
}
onMounted(() => {
  applyPrefs(getPrefs())
  window.addEventListener('typeduck:prefs-updated', (e) => applyPrefs((e as CustomEvent).detail))
})

/* ---------- 图片插入管线：图床上传或本地暂存，插入 markdown ---------- */

const imgVersion = ref(0)

async function onInsertImages(files: FileList) {
  const results: string[] = []
  for (const file of [...files]) {
    try {
      const { src, alt } = await insertImage(file)
      results.push(`![${alt}](${src})`)
    } catch (err) {
      store.showToast(err instanceof Error ? err.message : '图片插入失败')
    }
  }
  if (results.length) {
    editorRef.value?.insert(results.join('\n\n') + '\n\n')
    imgVersion.value++
  }
}

/** 内容以 < 开头自动视为 HTML 源码模式（微信兼容限制：样式须内联） */
const isHtmlMode = computed(() => isHtmlContent(content.value))

/** HTML 模式的微信兼容性问题（警示条用，实时扫描） */
const compatIssues = computed(() =>
  isHtmlMode.value ? checkWechatCompatibility(store.activeDoc?.content ?? '') : [],
)

/** 预览 HTML：Markdown 模式走主题渲染；HTML 模式直接渲染原文 */
const previewHtml = computed(() => {
  void imgVersion.value
  const raw = isHtmlMode.value ? store.activeDoc?.content ?? '' : store.renderedRichHtml
  return resolveTdimgs(raw)
})

/** HTML 模式预览套公众号阅读样式，且不叠加主题根样式（避免干扰原 HTML 自身排版） */
const previewRootStyle = computed(() => (isHtmlMode.value ? '' : rootStyle.value))
const previewCustomCss = computed(() => (isHtmlMode.value ? WECHAT_ARTICLE_CSS : store.customCss))

/** 双栏按比例同步滚动（可被偏好设置关闭）：
 *  1. 只响应 isTrusted 的原生滚动——程序写入 scrollTop 派发的事件不反向同步
 *  2. 节流 80ms + 写入阈值 3px——降低写入频率，避免滚动事件风暴导致卡顿
 *  3. 目标容器 120ms 内被用户滚动过（用户正控制它）时不写入——避免写入值与
 *     CodeMirror/浏览器的滚动机制竞争
 *  4. 编辑器侧走 CM 内部机制（scrollToRatio：行块定位 + scrollIntoView），不直接写
 *     scroller.scrollTop——避免与 CM 虚拟滚动测量竞争，消除松手后回弹
 *  5. 用户停止滚动 200ms 后做一次最终校正同步（此时两侧高度已稳定） */
let syncScrollEnabled = getPrefs().syncScroll
function setupSyncScroll() {
  let editorEl: HTMLElement | null = null
  let previewEl: HTMLElement | null = null
  let lastUserScroll: HTMLElement | null = null
  let lastSyncAt = 0
  const userScrolledAt = new Map<HTMLElement, number>()
  let settleTimer: ReturnType<typeof setTimeout> | undefined

  const sync = (from: HTMLElement, to: HTMLElement) => {
    if (!syncScrollEnabled) return
    const now = Date.now()
    if (now - lastSyncAt < 80) return
    // 目标容器正被用户滚动（120ms 内）时不写入，避免与用户/CM 的滚动机制竞争
    if (now - (userScrolledAt.get(to) ?? 0) < 120) return
    lastSyncAt = now
    requestAnimationFrame(() => {
      const fromMax = from.scrollHeight - from.clientHeight
      const toMax = to.scrollHeight - to.clientHeight
      if (fromMax <= 0 || toMax <= 0) return
      const ratio = from.scrollTop / fromMax
      const targetTop = ratio * toMax
      // 目标位置几乎没变化时不写入（避免无意义的写入与重渲染）
      if (Math.abs(to.scrollTop - targetTop) < 3) return
      if (to === editorEl && editorRef.value) {
        editorRef.value.scrollToRatio(ratio)
      } else {
        to.scrollTop = targetTop
      }
    })
  }

  const attach = () => {
    editorEl = editorRef.value?.getScrollEl() ?? null
    previewEl = previewRef.value?.getScrollEl() ?? null
    if (!editorEl || !previewEl) return false
    const onScroll = (from: HTMLElement, to: HTMLElement) => (e: Event) => {
      if (!e.isTrusted) return
      lastUserScroll = from
      userScrolledAt.set(from, Date.now())
      sync(from, to)
      // 用户停止滚动后做一次最终校正（此时两侧高度已稳定）
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        if (lastUserScroll && editorEl && previewEl) {
          if (lastUserScroll === editorEl) sync(editorEl, previewEl)
          else if (lastUserScroll === previewEl) sync(previewEl, editorEl)
        }
      }, 200)
    }
    editorEl.addEventListener('scroll', onScroll(editorEl, previewEl), { passive: true })
    previewEl.addEventListener('scroll', onScroll(previewEl, editorEl), { passive: true })
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
  // HTML 模式：复制/API 发布在公众号不生效，只能注入（桌面版）；网页版复制并明确提示
  if (isHtmlMode.value) {
    if (window.desktopAPI?.injectWechat) {
      const res = await window.desktopAPI.injectWechat(
        toWechatHtml(store.activeDoc?.content ?? '').html,
        store.activeDoc?.title ?? '',
      )
      if (res.ok) {
        store.showToast('已注入公众号编辑器 🦆')
        return
      }
      if (res.needPage) {
        store.showToast('请在公众号后台的图文编辑页再次点击注入')
        return
      }
      store.showToast(res.msg || '注入失败，请重试')
      return
    }
    // 网页版无注入能力：复制原文 + 提示粘贴后可能显示源码
    const ok = await copyHtmlToClipboard(resolveTdimgs(store.activeDoc?.content ?? ''))
    if (ok) {
      copied.value = true
      setTimeout(() => (copied.value = false), 800)
      store.showToast('⚠️ 网页版无法注入公众号——HTML 粘贴到微信会显示源码，建议用桌面版')
      return
    }
    store.showToast('复制失败，请重试')
    return
  }
  // Markdown 模式：复制主题内联渲染的 HTML（默认路径）
  // 检测本地图片：tdimg:// 转的 blob URL 粘贴到公众号后台必然裂图
  const localImgs = (store.activeDoc?.content ?? '').match(/tdimg:\/\/[\w-]+/g)?.length ?? 0
  if (localImgs > 0) {
    store.showToast(`⚠️ 文章含 ${localImgs} 张本地图片，直接粘贴会裂图——请用「草稿箱」发布（自动转传素材库），或到配图助手配置图床`)
    return
  }
  const payload = `<section style="${rootStyle.value}">${resolveTdimgs(store.renderedHtml)}</section>`
  const ok = await copyHtmlToClipboard(payload)
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

/** 状态栏统计：Markdown 按原文统计；HTML 模式按正文（去标签）统计并额外显示标签数 */
const statusStats = computed(() => {
  const doc = store.activeDoc
  if (!doc) return null
  if (isHtmlMode.value) {
    const src = doc.content
    const text = src.replace(/<[^>]*>/g, '')
    const words = text.replace(/\s/g, '').length
    return {
      mode: 'HTML',
      lines: src.split('\n').length,
      words,
      chars: text.length,
      tags: (src.match(/<[a-z!\/][^>]*>/gi) || []).length,
      minutes: Math.max(1, Math.ceil(words / 400)),
    }
  }
  return {
    mode: 'Markdown',
    lines: doc.content.split('\n').length,
    words: doc.wordCount,
    chars: doc.content.length,
    tags: null,
    minutes: doc.estimatedReadTime,
  }
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

/* ---------- 发布到公众号草稿箱 ---------- */

const showPublish = ref(false)
const showOss = ref(false)

async function onRemove(id: string) {
  if (confirm('确定删除该文档及其历史版本？此操作不可恢复。')) {
    await store.removeDoc(id)
  }
}

/* ---------- AI 辅助写作（BYOK，一套 OpenAI 兼容协议接所有厂商） ---------- */

const aiTask = ref<AiTask | null>(null)
let aiAbort: AbortController | undefined

/** 未配置时弹设置 + 提示，已配置返回 true */
function ensureAiReady(): boolean {
  if (aiStore.isConfigured) return true
  showSettings.value = true
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

/** AI 写文章：主题 + 风格 → 完整初稿 */
function onAiWrite(topic: string, style: string, audience: string, wordCount: string) {
  if (!ensureAiReady()) return
  runAiTask('write', { topic, style, audience, wordCount }, null)
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

/** 抓取/提取失败：切到粘贴模式，引导用户新窗口打开原文复制正文 */
function fallbackToPaste(url: string, instruction?: string, reason?: string) {
  rightView.value = 'ai'
  aiPanelRef.value?.openRewritePaste(url, instruction)
  store.showToast(reason ?? '未能提取正文：请在新窗口打开原文，复制内容粘贴到面板')
}

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
    fallbackToPaste(
      url,
      instruction,
      window.desktopAPI
        ? '抓取失败：请在新窗口打开原文，复制内容粘贴到面板'
        : '网页版受跨域限制，建议用桌面版体验链接改写——或直接粘贴正文到下方',
    )
    return
  }
  const article = extractArticle(html, url)
  if (article.text.length < 120) {
    fallbackToPaste(url, instruction)
    return
  }
  const source = article.title || title || url
  await store.createDoc(`> 原文：[${source}](${url})\n\n`)
  // 标题显式取文章原标题，避免自动提取把「原文：…链接」引用行当标题
  if (store.activeDoc) {
    store.activeDoc.title = source
    store.markUnsaved()
  }
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

/** 粘贴正文的改写（自动抓取失败的兜底路径） */
async function onRewriteText(url: string, text: string, instruction: string) {
  if (!ensureAiReady()) return
  if (text.trim().length < 50) {
    store.showToast('粘贴的正文太短了')
    return
  }
  await store.createDoc(`> 原文：${url && url !== '(手动粘贴)' ? `[链接](${url})` : '（手动粘贴正文）'}\n\n`)
  // 粘贴模式没有可靠标题，先给占位，改写完成后用户自行调整
  if (store.activeDoc) {
    store.activeDoc.title = 'AI 改写初稿'
    store.markUnsaved()
  }
  runAiTask('rewrite', { selection: text, instruction: instruction || undefined }, null)
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
    <!-- 通栏顶栏：品牌、当前文档与发布主操作 -->
    <header class="appbar">
      <div class="brand" role="button" tabindex="0" title="返回首页" @click="goHome" @keyup.enter="goHome">
        <img class="brand-img" src="/logo.png" alt="排版鸭" width="24" height="24" />
        <span class="brand-name">排版鸭</span>
        <span class="brand-slogan">排版呀，交给我吧！</span>
      </div>
      <div class="top-document">
        <input v-model="title" class="top-title-input" placeholder="无标题文档" />
      </div>
      <div class="appbar-right">
        <button class="top-icon" title="统一设置" @click="showSettings = true">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.7 3.6h4.6l.6 2.1a6.8 6.8 0 0 1 1.4.8l2.1-.7 2.3 4-1.6 1.4a7 7 0 0 1 0 1.7l1.6 1.4-2.3 4-2.1-.7a6.8 6.8 0 0 1-1.4.8l-.6 2.1H9.7l-.6-2.1a6.8 6.8 0 0 1-1.4-.8l-2.1.7-2.3-4 1.6-1.4a7 7 0 0 1 0-1.7L3.3 9.8l2.3-4 2.1.7a6.8 6.8 0 0 1 1.4-.8l.6-2.1Z"/><circle cx="12" cy="12" r="2.7"/></svg>
        </button>
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
        <button class="btn-publish" title="发布到公众号草稿箱" @click="showPublish = true">
          <svg viewBox="0 0 22 22"><path d="M3 11l16-7-5 14-4-5-7-2zM10 13l7-7" /></svg>发布
        </button>
        <button
          class="copy-primary"
          :class="{ done: copied }"
          :disabled="copied"
          :title="isHtmlMode && store.isDesktop ? '注入到公众号编辑器（HTML 内容复制不生效）' : '复制到公众号'"
          @click="onCopy"
        >
          <svg v-if="!copied && !(isHtmlMode && store.isDesktop)" class="ic" viewBox="0 0 22 22" aria-hidden="true"><path d="M9 7l-4 4 4 4M13 7l4 4-4 4" /></svg>
          <span v-else-if="isHtmlMode && store.isDesktop" class="code-ic">&lt;/&gt;</span>
          <span v-else class="check">✓</span>{{ copied ? '已复制' : isHtmlMode && store.isDesktop ? '注入到公众号' : '复制到公众号' }}
        </button>
      </div>
    </header>

    <!-- 主体：侧栏与子标题栏同一行起步，工作区在右侧纵排 -->
    <div class="body">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <DocumentList
          :docs="docsForList"
          :active-id="store.activeDoc?.id ?? null"
          @select="store.selectDoc"
          @create="store.createDoc"
          @remove="onRemove"
        />
      </aside>

      <div class="workarea">
        <div class="subbar">
          <button
            class="icon-btn sidebar-toggle"
            title="折叠/展开文档列表"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            <svg class="ic" viewBox="0 0 22 22" aria-hidden="true">
              <path v-if="!sidebarCollapsed" d="M4 7h14M4 11h14M4 15h14" />
              <path v-else d="M8.5 5l6 6-6 6" />
            </svg>
          </button>
          <div class="workspace-tabs" aria-label="编辑视图">
            <button v-for="v in viewModes" :key="v.mode" :class="{ active: viewMode === v.mode }" @click="viewMode = v.mode">{{ v.label.replace('仅', '') }}</button>
          </div>
          <button class="icon-btn" title="AI 生成标题" @click="onGenerateTitles">
            <svg class="ic" viewBox="0 0 22 22">
              <path
                d="M11 3l1.7 4.5L17 9l-4.3 1.5L11 15l-1.7-4.5L5 9l4.3-1.5zM17.5 14l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"
              />
            </svg>
          </button>
          <div class="subbar-right">
            <div class="tool-tabs" aria-label="工具">
              <button v-for="tool in toolViews" :key="tool.id" class="tool-tab" :class="{ active: rightView === tool.id }" @click="toggleRightView(tool.id)">{{ tool.label }}</button>
            </div>
            <span class="subbar-sep"></span>
            <button class="tool-collapse" title="折叠/展开右侧工具区" @click="toggleRightPane">
              <svg class="ic" viewBox="0 0 22 22" aria-hidden="true">
                <path v-if="rightView" d="M4 7h14M4 11h14M4 15h14" />
                <path v-else d="M13.5 5l-6 6 6 6" />
              </svg>
            </button>
          </div>
        </div>

        <div ref="contentRef" class="content" :class="`view-${viewMode}`">
          <aside
            ref="refPaneRef"
            v-show="refVisible"
            class="pane ref-pane"
            :style="refWidth != null ? { flex: `0 0 ${refWidth}px`, width: `${refWidth}px` } : undefined"
          >
            <ReferencePanel @close="viewMode = 'split'" />
          </aside>
          <div v-if="refVisible" class="split-divider" title="拖拽调整参考文宽度" @mousedown="onRefDragStart"></div>
          <section
            ref="editorPaneRef"
            v-show="viewMode === 'all' || viewMode === 'refedit' || viewMode === 'split' || viewMode === 'editor'"
            class="pane editor-pane"
            :style="(viewMode === 'split' || viewMode === 'all') && editorWidth != null ? { flex: `0 0 ${editorWidth}px`, width: `${editorWidth}px` } : undefined"
          >
            <div v-if="isHtmlMode && compatIssues.length" class="compat-bar">
              <span class="compat-title">⚠️ 微信兼容性</span>
              <ul>
                <li v-for="(issue, i) in compatIssues" :key="i" :class="issue.level">{{ issue.text }}</li>
              </ul>
            </div>
            <DuckEditor
              ref="editorRef"
              v-model="content"
              :html-mode="isHtmlMode"
              @ai="onAiAction"
              @insert-image="onInsertImages"
            />
          </section>
          <div v-if="viewMode === 'split' || viewMode === 'all'" class="split-divider" title="拖拽调整分栏宽度" @mousedown="onSplitDragStart"></div>
          <section v-show="viewMode === 'all' || viewMode === 'refprev' || viewMode === 'split' || viewMode === 'preview'" class="pane preview-pane">
            <DuckPreview
              ref="previewRef"
              :html="previewHtml"
              :custom-css="previewCustomCss"
              :background="store.theme.previewBackground"
              :root-style="previewRootStyle"
              :theme-name="store.theme.name"
              :article-title="store.activeDoc?.title"
              :account-name="store.accountName"
              @update:account-name="store.accountName = $event"
              @open-theme="rightView = 'theme'"
            >
              <template #bar-center>
                <span class="preview-save" :data-state="store.saveState"><i></i>{{ saveLabel }}</span>
              </template>
            </DuckPreview>
          </section>
          <aside v-if="rightView" class="pane right-pane">
            <div class="drawer-head"><div><strong>{{ toolViews.find((tool) => tool.id === rightView)?.label }}</strong><span>创作工具抽屉</span></div><button title="收起工具" @click="rightView = null">×</button></div>
            <template v-if="rightView === 'theme'">
              <div class="right-scroll">
                <ThemeSelector v-model="themeId" @remove-theme="onRemoveTheme" />
              </div>
            </template>
            <AiPanel
              v-else-if="rightView === 'ai'"
              ref="aiPanelRef"
              :task="aiTask"
              @stop="aiAbort?.abort()"
              @retry="onAiRetry"
              @apply="onAiApply"
              @use-title="onAiUseTitle"
              @close="rightView = null"
              @open-settings="showSettings = true"
              @run-custom="onAiCustom"
              @run-outline="onAiOutline"
              @run-write="onAiWrite"
              @run-digest="onAiDigest"
              @run-theme="onAiThemeGen"
              @run-rewrite="onRewriteUrl"
              @run-rewrite-text="onRewriteText"
              @save-theme="onAiSaveTheme"
              @discard="onAiDiscard"
            />
            <HotPanel v-else-if="rightView === 'hot'" @close="rightView = null" @rewrite="onHotRewrite" @open-settings="settingsSection = 'hot'; showSettings = true" />
            <ImagePanel
              v-else-if="rightView === 'image'"
              @close="rightView = null"
              @insert="(md: string) => editorRef?.insert(md)"
              @open-oss="showOss = true"
              @open-settings="settingsSection = 'media'; showSettings = true"
            />
            <HistoryPanel
              v-else
              :history="store.history"
              @restore="store.restoreHistory"
              @delete="store.removeHistory"
              @close="rightView = null"
            />
          </aside>
        </div>
      </div>
    </div>

    <footer class="status-bar">
      <span v-if="statusStats" class="status-meta">
        <i class="stat-mode" :class="statusStats.mode.toLowerCase()">{{ statusStats.mode }}</i>
        {{ statusStats.lines }} 行 · {{ statusStats.words }} 字 ·
        {{ statusStats.chars }} 字符<template v-if="statusStats.tags"> · 标签 {{ statusStats.tags }} 个</template> · 约 {{ statusStats.minutes }} 分钟
      </span>
      <span v-else class="status-meta">暂无文档</span>
      <span class="status-save" :data-state="store.saveState">{{ saveLabel }}</span>
    </footer>

    <PublishDialog v-if="showPublish" @close="showPublish = false" @open-settings="settingsSection = 'publish'; showSettings = true" />
    <OssSettings :open="showOss" @close="showOss = false" />
    <SettingsCenter v-if="showSettings" :initial-section="settingsSection as any" @close="showSettings = false" @open-oss="showSettings = false; showOss = true" />

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
  overflow: hidden;
  transition: width 0.18s ease, border-color 0.18s ease;
}
.sidebar.collapsed {
  width: 0;
  border-right: 0;
}
.sidebar.compact {
  width: 170px;
}
/* 参考文面板：与编辑/预览同级的面板，由视图胶囊控制显隐 */
.ref-pane {
  flex: 0 0 300px;
  width: 300px;
  border-right: 1px solid #e5e6eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 顶栏 */
.appbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 54px;
  flex-shrink: 0;
  padding: 0 16px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
}
/* 文档标题：顶栏正中，文字居中；浅色底 + 悬停/聚焦反馈，表明可编辑 */
.top-document{position:absolute;left:50%;transform:translateX(-50%);display:flex;align-items:center}.top-title-input{width:min(560px,calc(100vw - 520px));height:30px;border:0;outline:0;border-radius:6px;padding:0 12px;background:#f2f4f3;color:#1d2129;font-size:16px;font-weight:650;text-align:center;transition:background .15s ease,box-shadow .15s ease}.top-title-input:hover{background:#eaeeec}.top-title-input:focus{background:#fff;box-shadow:0 0 0 1.5px #07c160 inset}.top-icon{width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e5e6eb;border-radius:7px;background:#fff;color:#64716a;cursor:pointer}.top-icon:hover{border-color:#a8d5b9;background:#f4fbf7;color:#087c45}.top-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round}.btn-publish{display:inline-flex;align-items:center;gap:5px;height:32px;padding:0 12px;border:1px solid #e5e6eb;border-radius:7px;background:#fff;color:#53605a;font-size:13px;font-weight:650;cursor:pointer}.btn-publish:hover{border-color:#a8d5b9;color:#087c45;background:#f4fbf7}.btn-publish svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.brand {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
  cursor: pointer;
  user-select: none;
}
.brand:active {
  opacity: 0.7;
}
.brand-img {
  width: 24px;
  height: 24px;
  display: block;
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
.btn-export .ic {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
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
/* 注入按钮的代码图标 </>（HTML 模式桌面版显示） */
.copy-primary .code-ic {
  margin-right: 6px;
  padding: 0 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: #fff;
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
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
.workspace-tabs{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid #e5eae7;border-radius:7px;background:#f5f7f6}.workspace-tabs button{height:27px;padding:0 10px;border:0;border-radius:5px;background:transparent;color:#7d8983;font-size:12px;cursor:pointer}.workspace-tabs button.active{background:#fff;color:#1d2522;box-shadow:0 1px 3px rgba(20,40,29,.08);font-weight:650}.tool-tabs{display:inline-flex;align-items:center;gap:2px;padding:3px;border:1px solid #e5eae7;border-radius:7px;background:#f5f7f6;width:280px}.tool-tab{flex:1;height:27px;padding:0 6px;border:0;border-radius:5px;background:transparent;color:#7d8983;font-size:12px;cursor:pointer;white-space:nowrap}.tool-tab.active{background:#fff;color:#1d2522;box-shadow:0 1px 3px rgba(20,40,29,.08);font-weight:650}.subbar-sep{width:1px;height:16px;background:#e5eae7;margin:0 2px}.tool-collapse{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #e5e6eb;border-radius:6px;background:#fff;color:#68746e;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}.tool-collapse:hover{background:#f5f7f6;color:#1d2522}.tool-collapse .ic{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
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
/* 侧栏折叠按钮：与右侧工具区折叠按钮同尺寸（28px / 图标 15px） */
.sidebar-toggle {
  width: 28px;
  height: 28px;
}
.sidebar-toggle .ic {
  width: 15px;
  height: 15px;
  stroke-width: 1.8;
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
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
}
/* HTML 模式：微信兼容性警示条（实时扫描，不阻断编辑） */
.compat-bar {
  flex-shrink: 0;
  padding: 8px 14px;
  border-bottom: 1px solid #f0e2c0;
  background: #fffaf0;
  font-size: 12px;
  color: #8a6d3b;
  line-height: 1.7;
}
.compat-title {
  font-weight: 700;
  margin-right: 8px;
}
.compat-bar ul {
  margin: 2px 0 0;
  padding-left: 16px;
}
.compat-bar li.warn {
  color: #b06000;
}
.compat-bar li.info {
  color: #8a8a8a;
}
.preview-pane {
  flex: 1.1;
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
  background: #f3f4f6;
}
/* 双栏分割条：悬停深色高亮提示可拖拽 */
.split-divider {
  flex: 0 0 6px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 4;
  transition: background 0.15s ease;
}
.split-divider:hover {
  background: rgba(29, 37, 34, 0.3);
}
/* 预览头部条居中：保存状态（圆点 + 文案，与手机/公众号同一条） */
.preview-save {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #8b9690;
  font-size: 11px;
  white-space: nowrap;
}
.preview-save i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #63b889;
}
.preview-save[data-state='unsaved'] {
  color: #c27c2f;
}
.preview-save[data-state='unsaved'] i {
  background: #d8913e;
}
.preview-save[data-state='saving'] {
  color: #5487ad;
}
.preview-save[data-state='saving'] i {
  background: #6fa7cc;
}
.right-pane {
  flex: 0 0 340px;
  width: 340px;
  margin-left: auto; /* 贴最右：编辑区隐藏/变窄时工具区不会跑到中间 */
  background: #fff;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.drawer-head{display:flex;align-items:center;justify-content:space-between;min-height:52px;padding:0 14px;border-bottom:1px solid #e5eae7}.drawer-head div{display:grid;gap:1px}.drawer-head strong{color:#1d2522;font-size:13px}.drawer-head span{color:#a0aaa5;font-size:10px}.drawer-head button{width:26px;height:26px;border:0;border-radius:6px;background:transparent;color:#9aa59f;font-size:18px;cursor:pointer}.drawer-head button:hover{background:#f2f5f3;color:#4e5b54}
.right-scroll {
  flex: 1;
  overflow-y: auto;
}

/* 禁用浏览器 scroll anchoring：内容更新时滚动位置保持像素不变，
   否则视口可能被锚定拉回，表现为滚动中/松手后内容自动回弹 */
.sidebar,
.right-scroll {
  overflow-anchor: none;
}
.pane :deep(.cm-scroller),
.pane :deep(.preview-scroll),
.pane :deep(.ref-scroll) {
  overflow-anchor: none;
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
/* 模式徽标：HTML（橙）/ Markdown（灰），与编辑器工具栏徽标一致 */
.stat-mode {
  font-style: normal;
  font-weight: 700;
  margin-right: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  letter-spacing: 0.5px;
}
.stat-mode.markdown {
  background: #f2f3f5;
  color: #68746e;
}
.stat-mode.html {
  background: #fff3e0;
  color: #b06000;
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
.right-pane :deep(.panel-head){display:none}
@media (max-width:1060px){.brand-slogan,.btn-publish{display:none}.top-title-input{width:min(340px,calc(100vw - 520px))}.tool-tabs{width:270px}}
@media (max-width:760px){.appbar{position:relative;height:52px;padding:0 10px;gap:8px}.brand{min-width:auto;gap:6px}.brand-name{font-size:14px}.top-document{position:absolute;left:10px;right:94px;top:58px;transform:none;z-index:3}.top-title-input{width:100%;height:30px;border:1px solid #e5eae7;border-radius:6px;padding:0 8px;background:#fff;font-size:13px}.split-divider{display:none}.tool-tabs{width:min(280px,75vw)}.appbar-right{gap:5px}.copy-primary{padding:0 10px;font-size:12px}.top-icon{width:30px;height:30px}.workarea{padding-top:42px}.subbar{height:44px;padding:0 8px;gap:6px;overflow-x:auto}.subbar-right{gap:3px}.tool-tab{padding:0 7px;font-size:11px}.workspace-tabs button{padding:0 8px}.right-pane{position:fixed;top:52px;right:0;bottom:30px;z-index:100;width:min(340px,92vw);box-shadow:-8px 0 24px rgba(20,35,27,.12)}.sidebar{display:none}.sidebar-toggle{display:none}.ref-pane{display:none}.content{min-width:0}.content.view-editor .preview-pane,.content.view-split .preview-pane,.content.view-all .preview-pane{display:none}.content.view-preview .editor-pane{display:none}.content.view-preview .preview-pane{display:flex;flex:1;border-right:0}.editor-pane{flex:1;border-right:0}}
</style>
