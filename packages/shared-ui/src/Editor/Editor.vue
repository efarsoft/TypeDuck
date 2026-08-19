<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const host = ref<HTMLElement>()
let view: EditorView | undefined

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

const icons: Record<string, string> = {
  bold: '<path d="M7 5h5a3 3 0 0 1 0 6H7zM7 11h6a3 3 0 0 1 0 6H7z"/>',
  italic: '<path d="M9 5h5M9 17h5M12 5l-3 12"/>',
  strike: '<path d="M5 11h12M7 7a3 3 0 0 1 3-2h2a3 3 0 0 1 3 2M7 15a3 3 0 0 0 3 2h2a3 3 0 0 0 3-2"/>',
  quote: '<path d="M8 6c-1 0-2 1-2 2v4c0 1 1 2 2 2h1V8H7c0-1 .5-1 1-1zM18 6c-1 0-2 1-2 2v4c0 1 1 2 2 2h1V8h-1c0-1 .5-1 1-1z"/>',
  code: '<path d="M9 7l-4 4 4 4M13 7l4 4-4 4"/>',
  codeblock: '<path d="M8 7l-3 3 3 3M14 7l3 3-3 3M11 6l-1 10"/>',
  ul: '<path d="M5 6h.01M5 12h.01M5 18h.01M9 6h10M9 12h10M9 18h10"/>',
  ol: '<path d="M5 6h.01M5 12h.01M5 18h.01M9 6h10M9 12h10M9 18h10"/>',
  link: '<path d="M9 12h4M10 8a4 4 0 0 1 0 8h-1M12 12a4 4 0 0 1 0-8h1"/>',
  image: '<path d="M4 5h12v12H4zM4 13l3-3 3 3 2-2 4 4M8 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2"/>',
}

/** 快速格式按钮（图标化，内嵌于编辑区顶部） */
const quickButtons: { icon: string; title: string; action: () => void }[] = [
  { icon: 'bold', title: '粗体', action: () => doWrap('**', '**') },
  { icon: 'italic', title: '斜体', action: () => doWrap('*', '*') },
  { icon: 'strike', title: '删除线', action: () => doWrap('~~', '~~') },
  { icon: 'quote', title: '引用', action: () => doInsert('\n> ') },
  { icon: 'code', title: '行内代码', action: () => doWrap('`', '`') },
  { icon: 'codeblock', title: '代码块', action: () => doInsert('\n```js\n\n```\n') },
  { icon: 'ul', title: '无序列表', action: () => doInsert('\n- ') },
  { icon: 'ol', title: '有序列表', action: () => doInsert('\n1. ') },
  { icon: 'link', title: '链接', action: () => doInsert('[标题](https://)') },
  { icon: 'image', title: '图片', action: () => doInsert('![描述](https://)') },
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
      }),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': { fontFamily: 'Menlo, Consolas, "Courier New", monospace' },
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
})
</script>

<template>
  <section class="editor-panel">
    <div class="panel-head"><span>Markdown 内容</span></div>
    <div class="format-bar">
      <button
        v-for="btn in quickButtons"
        :key="btn.title"
        class="fbtn"
        :title="btn.title"
        @click="btn.action"
      >
        <svg class="ic" viewBox="0 0 22 22" v-html="icons[btn.icon]"></svg>
      </button>
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
  background: #fff;
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
.fbtn .ic {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
