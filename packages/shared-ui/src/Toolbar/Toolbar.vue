<script setup lang="ts">
const emit = defineEmits<{
  (e: 'insert', text: string): void
  (e: 'wrap', prefix: string, suffix: string): void
  (e: 'copy'): void
  (e: 'export'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-history'): void
}>()

const buttons: {
  label: string
  title: string
  action: () => void
}[] = [
  { label: 'B', title: '粗体', action: () => emit('wrap', '**', '**') },
  { label: 'I', title: '斜体', action: () => emit('wrap', '*', '*') },
  { label: 'S', title: '删除线', action: () => emit('wrap', '~~', '~~') },
  { label: 'H1', title: '一级标题', action: () => emit('insert', '\n# ') },
  { label: 'H2', title: '二级标题', action: () => emit('insert', '\n## ') },
  { label: 'H3', title: '三级标题', action: () => emit('insert', '\n### ') },
  { label: '❝', title: '引用', action: () => emit('insert', '\n> ') },
  { label: '</>', title: '代码', action: () => emit('wrap', '`', '`') },
  { label: '⌗', title: '代码块', action: () => emit('insert', '\n```js\n\n```\n') },
  { label: '•', title: '无序列表', action: () => emit('insert', '\n- ') },
  { label: '1.', title: '有序列表', action: () => emit('insert', '\n1. ') },
  { label: '▭', title: '表格', action: () => emit('insert', '\n| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |\n') },
  { label: '—', title: '分割线', action: () => emit('insert', '\n\n---\n\n') },
  { label: '🔗', title: '链接', action: () => emit('insert', '[标题](https://)') },
  { label: '🖼', title: '图片', action: () => emit('insert', '![描述](https://)') },
]
</script>

<template>
  <div class="toolbar">
    <button
      v-for="btn in buttons"
      :key="btn.title"
      class="tb-btn"
      :title="btn.title"
      @click="btn.action"
    >
      {{ btn.label }}
    </button>
    <span class="spacer"></span>
    <button class="tb-btn" title="历史版本" @click="emit('toggle-history')">🕘</button>
    <button class="tb-btn" title="主题" @click="emit('toggle-theme')">🎨</button>
    <button class="tb-btn" title="导出 HTML" @click="emit('export')">📤</button>
    <button class="tb-btn copy-btn" title="复制到公众号" @click="emit('copy')">📋 复制到公众号</button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
  flex-wrap: wrap;
}
.tb-btn {
  min-width: 30px;
  height: 28px;
  padding: 0 6px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #444;
}
.tb-btn:hover {
  background: #f2f3f5;
}
.spacer {
  flex: 1;
}
.copy-btn {
  background: #07c160;
  color: #fff;
  font-weight: 600;
  padding: 0 12px;
}
.copy-btn:hover {
  background: #06ad56;
}
</style>
