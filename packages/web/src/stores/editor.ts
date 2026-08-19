import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { getTheme, render } from '@typeduck/core'
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

**排版鸭**是一款专为微信公众号创作者打造的 Markdown 排版工具。

## 快速上手

1. 在左侧编辑 Markdown 源码
2. 右侧实时预览公众号排版效果
3. 点击右上角 **📋 复制到公众号**
4. 粘贴到公众号编辑器即可发布

## 支持的语法

- 标题、**粗体**、*斜体*、~~删除线~~
- [链接](https://github.com) 与图片
- > 引用：本地优先、完全免费
- \`行内代码\` 与代码块：

\`\`\`js
console.log('Hello 排版鸭!')
\`\`\`

| 语法 | 支持 |
| --- | :---: |
| GFM 表格 | ✅ |
| 任务列表 | ✅ |

- [x] 自动保存
- [x] 历史版本

---

开始你的创作吧！🦆
`

export type SaveState = 'saved' | 'saving' | 'unsaved'

function countWords(text: string): number {
  return text.replace(/[\s#>*`~\-|!\[\]()]/g, '').length
}

export const useEditorStore = defineStore('editor', () => {
  const docs = ref<Doc[]>([])
  const activeDoc = ref<Doc | null>(null)
  const saveState = ref<SaveState>('saved')
  const history = ref<DocHistory[]>([])
  const toast = ref('')

  const theme = computed(() => getTheme(activeDoc.value?.themeId ?? 'minimal-white'))
  const renderedHtml = computed(() =>
    activeDoc.value ? render(activeDoc.value.content, theme.value) : '',
  )

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  function showToast(msg: string) {
    toast.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 2000)
  }

  async function load() {
    docs.value = await db.getAllDocs()
    if (docs.value.length === 0) {
      await createDoc()
    } else {
      activeDoc.value = docs.value[0]
    }
    // 页面隐藏/关闭前兜底落盘，避免防抖窗口内丢改动
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flushSave()
    })
    window.addEventListener('beforeunload', () => void flushSave())
  }

  async function createDoc() {
    const now = Date.now()
    const doc: Doc = {
      id: uuid(),
      title: '',
      content: WELCOME_CONTENT,
      themeId: 'minimal-white',
      createdAt: now,
      updatedAt: now,
      tags: [],
      status: 'draft',
      wordCount: countWords(WELCOME_CONTENT),
      estimatedReadTime: Math.max(1, Math.ceil(countWords(WELCOME_CONTENT) / 400)),
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
    saveState.value = 'unsaved'
    clearTimeout(saveTimer)
    // 捕获目标文档引用，避免防抖期间切换文档后误存到别的文档
    saveTimer = setTimeout(() => saveDoc(doc), 500)
  }

  async function saveDoc(doc: Doc) {
    saveState.value = 'saving'
    doc.updatedAt = Date.now()
    doc.wordCount = countWords(doc.content)
    doc.estimatedReadTime = Math.max(1, Math.ceil(doc.wordCount / 400))
    await db.putDoc(doc)
    if (activeDoc.value?.id === doc.id) saveState.value = 'saved'
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
