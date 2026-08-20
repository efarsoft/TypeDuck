import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getTheme, render, scopeCss } from '@typeduck/core'
import type { Doc, DocHistory } from '../db'
import * as db from '../db'

/** crypto.randomUUID 仅在安全上下文可用（file:// 等），提供兜底 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const WELCOME_CONTENT = `# 排版呀，交给我吧！

**排版鸭**是一款专为微信公众号创作者打造的 Markdown 排版工具——本地优先、完全免费、MIT 开源。

## 三步搞定一篇公众号文章

1. 在左侧用 Markdown 写作（支持 \`**粗体**\`、\`*斜体*\`、代码块、表格、任务列表）
2. 在右侧主题面板挑选排版主题（内置 **32 套**，按日常写作 / 个性表达 / 文艺叙事分组）
3. 点击顶部 **复制到公众号**，粘贴到公众号后台——样式完整保留

## 预览的两种尺寸

预览区顶部可切换 **手机（390px）** 和 **公众号（677px）** 宽度：手机看阅读体验，公众号宽度做发布前终检。

## 写给技术作者

> 代码高亮复制到公众号依然保留配色——所有样式已内联化，微信编辑器清洗不掉。

\`\`\`js
console.log('Hello 排版鸭!')
\`\`\`

| 能力 | 状态 |
| --- | :---: |
| 32 套主题一键切换 | ✅ |
| 自动保存 + 30 版历史 | ✅ |
| 双栏同步滚动 | ✅ |
| 导出 HTML / Word / PDF / Markdown | ✅ |
| AI 辅助写作（BYOK，OpenAI 兼容） | ✅ |
| 本地文件（桌面版） | ✅ |

- [x] 数据只存在你自己的浏览器里
- [x] 无需注册登录

---

开始你的创作吧！🦆
`

export type SaveState = 'saved' | 'saving' | 'unsaved'

function countWords(text: string): number {
  return text.replace(/[\s#>*`~\-|!\[\]()]/g, '').length
}

/** 从内容提取标题：优先一级/二级标题，其次首个非空行（去除 Markdown 记号）。
 *  不做长度截断——列表/输入框的显示省略交给 CSS，公众号标题栏上限 64 字 */
function extractTitle(content: string): string {
  const heading = content.match(/^#{1,3}\s+(.+)$/m)
  return (heading ? heading[1] : content.split('\n').find((l) => l.trim()) || '')
    .replace(/[#*`~>\[\]()!]/g, '')
    .trim()
}

export const useEditorStore = defineStore('editor', () => {
  const docs = ref<Doc[]>([])
  const activeDoc = ref<Doc | null>(null)
  const saveState = ref<SaveState>('saved')
  const history = ref<DocHistory[]>([])
  const toast = ref('')

  /** 公众号名称：预览头部模拟用，localStorage 持久化 */
  const accountName = ref(localStorage.getItem('typeduck:accountName') || 'AI猿叔')
  watch(accountName, (v) => localStorage.setItem('typeduck:accountName', v))

  const theme = computed(() => getTheme(activeDoc.value?.themeId ?? 'minimal-white'))
  const renderedHtml = computed(() =>
    activeDoc.value ? render(activeDoc.value.content, theme.value) : '',
  )
  /** Word 友好版：不带 !important（Word 的 HTML 解析器不识别，会整段错乱） */
  const renderedHtmlPlain = computed(() =>
    activeDoc.value
      ? render(activeDoc.value.content, theme.value, { important: false })
      : '',
  )
  /** 进阶渲染版（rich）：保留 class、不加 !important，供网页预览 / HTML / PDF 导出使用，customCss 可覆盖 */
  const renderedRichHtml = computed(() =>
    activeDoc.value ? render(activeDoc.value.content, theme.value, { rich: true }) : '',
  )
  /** 当前主题的 customCss，已加 .td-rich 作用域；公众号复制与 Word 导出不使用 */
  const customCss = computed(() => scopeCss(theme.value.customCss ?? '', '.td-rich'))

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  function showToast(msg: string) {
    toast.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 2000)
  }

  async function load() {
    docs.value = await db.getAllDocs()
    // 历史遗留修复：无标题文档回填；被旧版 24 字截断的标题还原为全文
    for (const doc of docs.value) {
      const full = extractTitle(doc.content)
      const truncated = doc.title.endsWith('…') && full.startsWith(doc.title.slice(0, -1))
      if (!doc.title || truncated) {
        doc.title = full
        await db.putDoc(doc)
      }
    }
    if (docs.value.length === 0) {
      // 首次使用：唯一一次填入欢迎文案
      await createDoc(WELCOME_CONTENT)
    } else {
      activeDoc.value = docs.value[0]
    }
    // 页面隐藏/关闭前兜底落盘，避免防抖窗口内丢改动
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSave()
    })
    window.addEventListener('beforeunload', () => void flushSave())
  }

  /** 新建文档：默认空白；仅首次使用（库为空）时由 load() 传入欢迎文案 */
  async function createDoc(initialContent = '') {
    const now = Date.now()
    const doc: Doc = {
      id: uuid(),
      title: '',
      content: initialContent,
      themeId: 'minimal-white',
      createdAt: now,
      updatedAt: now,
      tags: [],
      status: 'draft',
      wordCount: countWords(initialContent),
      estimatedReadTime: Math.max(1, Math.ceil(countWords(initialContent) / 400)),
    }
    await db.putDoc(doc)
    docs.value.unshift(doc)
    activeDoc.value = doc
    saveState.value = 'saved'
  }

  function selectDoc(id: string) {
    if (activeDoc.value?.id === id) return
    // 切走前先把当前文档的未保存改动落盘
    void flushSave()
    activeDoc.value = docs.value.find((d) => d.id === id) ?? null
  }

  async function removeDoc(id: string) {
    await db.deleteDoc(id)
    docs.value = docs.value.filter((d) => d.id !== id)
    if (activeDoc.value?.id === id) {
      activeDoc.value = docs.value[0] ?? null
      if (!activeDoc.value) await createDoc()
    }
  }

  function markUnsaved() {
    const doc = activeDoc.value
    if (!doc) return
    // 标题为空时从内容自动提取，避免满屏「无标题文档」
    if (!doc.title.trim()) {
      doc.title = extractTitle(doc.content)
    }
    saveState.value = 'unsaved'
    clearTimeout(saveTimer)
    // 捕获目标文档引用，避免防抖期间切换文档后误存到别的文档
    saveTimer = setTimeout(() => saveDoc(doc), 500)
  }

  async function saveDoc(doc: Doc) {
    // 保存状态只描述"当前活动文档"；后台 flush 保存其他文档时不动它
    const isActive = activeDoc.value?.id === doc.id
    if (isActive) saveState.value = 'saving'
    doc.updatedAt = Date.now()
    doc.wordCount = countWords(doc.content)
    doc.estimatedReadTime = Math.max(1, Math.ceil(doc.wordCount / 400))
    try {
      await db.putDoc(doc)
      if (isActive) saveState.value = 'saved'
    } catch {
      if (isActive) saveState.value = 'unsaved'
      return
    }
    await snapshotIfChanged(doc)
  }

  const lastSnapshotAt = new Map<string, { at: number; content: string }>()

  /** 内容有变化时落历史版本：间隔至少 60s，且与上一版内容相同则跳过 */
  async function snapshotIfChanged(doc: Doc) {
    const last = lastSnapshotAt.get(doc.id)
    if (last && last.content === doc.content) return
    if (last && Date.now() - last.at < 60_000) return
    lastSnapshotAt.set(doc.id, { at: Date.now(), content: doc.content })
    await db.addHistory(doc)
    if (activeDoc.value?.id === doc.id) await refreshHistory()
  }

  /** 立即落盘未保存的改动（切换文档 / 页面隐藏或关闭前调用） */
  async function flushSave() {
    if (saveState.value !== 'unsaved' || !activeDoc.value) return
    clearTimeout(saveTimer)
    await saveDoc(activeDoc.value)
  }

  async function refreshHistory() {
    if (!activeDoc.value) return
    history.value = await db.getHistory(activeDoc.value.id)
  }

  async function restoreHistory(entry: DocHistory) {
    const doc = activeDoc.value
    if (!doc) return
    // 覆盖前先把当前内容留一版快照，保证「撤销恢复」有路可退
    await db.addHistory(doc)
    lastSnapshotAt.set(doc.id, { at: Date.now(), content: doc.content })
    doc.content = entry.content
    doc.title = entry.title
    markUnsaved()
    await refreshHistory()
    showToast('已恢复到历史版本')
  }

  watch(
    () => activeDoc.value?.id,
    () => refreshHistory(),
  )

  /* ---------- 桌面版（Electron）本地文件集成 ---------- */

  const isDesktop = !!window.desktopAPI
  /** 文档 id -> 已保存的本地文件路径（仅桌面版，内存态） */
  const filePaths = new Map<string, string>()

  /** 从磁盘打开 .md 文件，作为新文档载入 */
  async function openFromDisk() {
    if (!window.desktopAPI) return
    const result = await window.desktopAPI.openFile()
    if (!result) return
    const now = Date.now()
    const doc: Doc = {
      id: uuid(),
      title: result.title,
      content: result.content,
      themeId: 'minimal-white',
      createdAt: now,
      updatedAt: now,
      tags: [],
      status: 'draft',
      wordCount: countWords(result.content),
      estimatedReadTime: Math.max(1, Math.ceil(countWords(result.content) / 400)),
    }
    await db.putDoc(doc)
    docs.value.unshift(doc)
    activeDoc.value = doc
    filePaths.set(doc.id, result.filePath)
    saveState.value = 'saved'
    showToast(`已打开 ${result.title}.md`)
  }

  /** 保存当前文档到本地文件（无路径时弹另存为） */
  async function saveToDisk(forceSaveAs = false) {
    const doc = activeDoc.value
    if (!doc || !window.desktopAPI) return
    try {
      let filePath = forceSaveAs ? null : filePaths.get(doc.id) ?? null
      if (!filePath) {
        const result = await window.desktopAPI.saveFileDialog(
          doc.content,
          (doc.title || '未命名文档') + '.md',
        )
        if (!result) return
        filePath = result.filePath
      } else {
        await window.desktopAPI.saveFile(filePath, doc.content)
      }
      filePaths.set(doc.id, filePath)
      if (!doc.title) {
        doc.title = filePath.split(/[\\/]/).pop()!.replace(/\.md$/i, '') || doc.title
      }
      saveState.value = 'saved'
      showToast(`已保存到 ${filePath}`)
    } catch {
      showToast('保存失败，请重试')
    }
  }

  return {
    docs,
    activeDoc,
    saveState,
    history,
    toast,
    theme,
    renderedHtml,
    renderedHtmlPlain,
    renderedRichHtml,
    customCss,
    accountName,
    isDesktop,
    load,
    createDoc,
    selectDoc,
    removeDoc,
    markUnsaved,
    restoreHistory,
    showToast,
    openFromDisk,
    saveToDisk,
  }
})
