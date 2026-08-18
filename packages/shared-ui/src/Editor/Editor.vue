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

watch(
  () => props.modelValue,
  (value) => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  },
)

onUnmounted(() => view?.destroy())

defineExpose({
  getScrollEl,
  /** 在光标处插入文本 */
  insert(text: string) {
    if (!view) return
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
    view.focus()
  },
  /** 用文本包裹当前选区 */
  wrapSelection(prefix: string, suffix = prefix) {
    if (!view) return
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const insert = prefix + selected + suffix
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + prefix.length, head: from + prefix.length + selected.length },
    })
    view.focus()
  },
})
</script>

<template>
  <div ref="host" class="editor-host"></div>
</template>

<style scoped>
.editor-host {
  height: 100%;
  overflow: hidden;
}
.editor-host :deep(.cm-editor) {
  height: 100%;
}
</style>
