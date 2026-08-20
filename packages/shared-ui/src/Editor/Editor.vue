<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { undo, redo } from '@codemirror/commands'
import type { AiActionId } from '@typeduck/core'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'ai', action: AiActionId): void
}>()

const host = ref<HTMLElement>()
let view: EditorView | undefined

/** 当前是否有选区（AI 的润色/扩写/缩写依赖它动态禁用按钮） */
const hasSelection = ref(false)

/** 编辑器滚动容器，供双栏同步滚动使用 */
function getScrollEl(): HTMLElement | null {
  return view?.dom.querySelector('.cm-scroller') ?? null
}

/** 在光标处插入文本 */
function doInsert(text: string) {
  if (!view) return
  const { from, to } = view.state.selection.main
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
  view.focus()
}

/** 用文本包裹当前选区 */
function doWrap(prefix: string, suffix = prefix) {
  if (!view) return
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const insert = prefix + selected + suffix
  view.dispatch({
    changes: { from, to, insert },
    selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
  })
  view.focus()
}

/** 选区快照：文本 + 范围 + 光标前全文（AI 任务的输入与回写位置） */
function getSelectionInfo(): { text: string; from: number; to: number; before: string } {
  if (!view) return { text: '', from: 0, to: 0, before: '' }
  const { from, to } = view.state.selection.main
  return {
    text: view.state.sliceDoc(from, to),
    from,
    to,
    before: view.state.sliceDoc(0, from),
  }
}

/** 替换指定范围（AI「替换选区」用） */
function replaceRange(from: number, to: number, text: string) {
  if (!view) return
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
  view.focus()
}

const icons: Record<string, string> = {
  bold: '<path d="M7 5h5a3 3 0 0 1 0 6H7zM7 11h6a3 3 0 0 1 0 6H7z"/>',
  italic: '<path d="M9 5h5M9 17h5M12 5l-3 12"/>',
  strike: '<path d="M5 11h12M7 7a3 3 0 0 1 3-2h2a3 3 0 0 1 3 2M7 15a3 3 0 0 0 3 2h2a3 3 0 0 0 3-2"/>',
  quote: '<path d="M8 6c-1 0-2 1-2 2v4c0 1 1 2 2 2h1V8H7c0-1 .5-1 1-1zM18 6c-1 0-2 1-2 2v4c0 1 1 2 2 2h1V8h-1c0-1 .5-1 1-1z"/>',
  code: '<path d="M9 7l-4 4 4 4M13 7l4 4-4 4"/>',
  codeblock: '<path d="M8 7l-3 3 3 3M14 7l3 3-3 3M11 6l-1 10"/>',
  ul: '<path d="M5 6h.01M5 12h.01M5 18h.01M9 6h10M9 12h10M9 18h10"/>',
  ol: '<path d="M5 6h.01M5 12h.01M5 18h.01M9 6h10M9 12h10M9 18h10"/>',
  task: '<path d="M5 6h2v2H5zM5 6v2h2V6zM5 11h2v2H5zM5 16h2v2H5zM9 7h8M9 12h8M9 17h8"/>',
  link: '<path d="M9 12h4M10 8a4 4 0 0 1 0 8h-1M12 12a4 4 0 0 1 0-8h1"/>',
  image: '<path d="M4 5h12v12H4zM4 13l3-3 3 3 2-2 4 4M8 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>',
  table: '<path d="M3 5h14v12H3zM3 9h14M3 13h14M8 5v12M12 5v12"/>',
  undo: '<path d="M8 5L3 10l5 5M3 10h9a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="M14 5l5 5-5 5M19 10h-9a5 5 0 0 0 0 10h3"/>',
}

/** 快速格式按钮：按「标题 / 文字格式 / 块级 / 插入 / AI / 历史」分组（label 为文字按钮，icon 为图标按钮） */
const buttonGroups: {
  icon?: string
  label?: string
  title: string
  action: () => void
  ai?: boolean
  disabled?: () => boolean
}[][] = [
  [
    { label: 'H1', title: '一级标题', action: () => doInsert('\n# ') },
    { label: 'H2', title: '二级标题', action: () => doInsert('\n## ') },
    { label: 'H3', title: '三级标题', action: () => doInsert('\n### ') },
  ],
  [
    { icon: 'bold', title: '粗体', action: () => doWrap('**', '**') },
    { icon: 'italic', title: '斜体', action: () => doWrap('*', '*') },
    { icon: 'strike', title: '删除线', action: () => doWrap('~~', '~~') },
  ],
  [
    { icon: 'quote', title: '引用', action: () => doInsert('\n> ') },
    { icon: 'code', title: '行内代码', action: () => doWrap('`', '`') },
    { icon: 'codeblock', title: '代码块', action: () => doInsert('\n```js\n\n```\n') },
    { icon: 'ul', title: '无序列表', action: () => doInsert('\n- ') },
    { icon: 'ol', title: '有序列表', action: () => doInsert('\n1. ') },
    { icon: 'task', title: '任务清单', action: () => doInsert('\n- [ ] ') },
    { icon: 'table', title: '表格', action: () => doInsert('\n| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |\n') },
  ],
  [
    { icon: 'link', title: '链接', action: () => doInsert('[标题](https://)') },
    { icon: 'image', title: '图片', action: () => doInsert('![描述](https://)') },
  ],
  [
    { label: '润色', title: 'AI 润色选中文字', ai: true, action: () => emit('ai', 'polish'), disabled: () => !hasSelection.value },
    { label: '扩写', title: 'AI 扩写选中文字', ai: true, action: () => emit('ai', 'expand'), disabled: () => !hasSelection.value },
    { label: '缩写', title: 'AI 缩写选中文字', ai: true, action: () => emit('ai', 'shorten'), disabled: () => !hasSelection.value },
    { label: '续写', title: 'AI 从光标处续写', ai: true, action: () => emit('ai', 'continue') },
  ],
  [
    { icon: 'undo', title: '撤销 (Ctrl+Z)', action: () => view && undo(view) },
    { icon: 'redo', title: '重做 (Ctrl+Y)', action: () => view && redo(view) },
  ],
]

onMounted(() => {
  view = new EditorView({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      markdown({ codeLanguages: languages, base: markdownLanguage }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          emit('update:modelValue', update.state.doc.toString())
        }
        if (update.docChanged || update.selectionSet) {
          hasSelection.value = !update.state.selection.main.empty
        }
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px', backgroundColor: '#fafbfc' },
        '.cm-scroller': { fontFamily: 'Menlo, Consolas, "Courier New", monospace' },
        '.cm-gutters': { backgroundColor: '#fafbfc', borderColor: '#edf0f2' },
        '.cm-activeLine': { backgroundColor: 'rgba(7,193,96,0.04)' },
      }),
    ],
    parent: host.value!,
  })
})

onUnmounted(() => view?.destroy())

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  },
)

defineExpose({
  getScrollEl,
  insert: doInsert,
  wrapSelection: doWrap,
  getSelectionInfo,
  replaceRange,
})
</script>

<template>
  <section class="editor-panel">
    <div class="format-bar">
      <template v-for="(group, gi) in buttonGroups" :key="gi">
        <span v-if="gi > 0" class="fdivider"></span>
        <button
          v-for="btn in group"
          :key="btn.title"
          class="fbtn"
          :class="{ 'fbtn-text': btn.label, 'fbtn-ai': btn.ai }"
          :title="btn.title"
          :disabled="btn.disabled?.() ?? false"
          @click="btn.action"
        >
          <svg v-if="btn.icon" class="ic" viewBox="0 0 22 22" v-html="icons[btn.icon]"></svg>
          <template v-else>{{ btn.label }}</template>
        </button>
      </template>
    </div>
    <div ref="host" class="editor-host"></div>
  </section>
</template>

<style scoped>
.editor-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #fafbfc; /* 工作区浅灰底，与预览区（成品区）形成分区 */
}
.editor-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor-host :deep(.cm-editor) {
  height: 100%;
}
.format-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.fdivider {
  width: 1px;
  height: 16px;
  background: #e5e6eb;
  margin: 0 6px;
}
.fbtn {
  width: 30px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #4e5969;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
}
.fbtn:hover {
  background: #eef0f2;
  color: #1d2129;
}
.fbtn:disabled {
  opacity: 0.35;
  cursor: default;
}
.fbtn:disabled:hover {
  background: transparent;
  color: #4e5969;
}
/* AI 动作按钮：品牌绿，与普通格式按钮区分 */
.fbtn-ai {
  color: #07c160;
  font-weight: 600;
}
.fbtn-ai:not(:disabled):hover {
  background: #e8f9ef;
  color: #06ad56;
}
.fbtn .ic {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
/* 文字型按钮（H1/H2/H3） */
.fbtn-text {
  width: auto;
  padding: 0 8px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
</style>
