<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const emit = defineEmits<{
  (e: 'insert', text: string): void
  (e: 'wrap', prefix: string, suffix: string): void
  (e: 'export'): void
  (e: 'toggle-theme'): void
  (e: 'toggle-history'): void
  (e: 'set-view', mode: 'split' | 'editor' | 'preview'): void
}>()

type IconName =
  | 'bold' | 'italic' | 'strike' | 'quote' | 'code' | 'codeblock'
  | 'ul' | 'ol' | 'link' | 'image' | 'table' | 'hr'
  | 'theme' | 'history' | 'split' | 'editor' | 'preview'

const icons: Record<IconName, string> = {
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
  table: '<path d="M3 5h14v12H3zM3 9h14M3 13h14M8 5v12M12 5v12"/>',
  hr: '<path d="M4 11h12"/>',
  theme: '<path d="M11 3a8 8 0 1 0 0 16 8 8 0 0 1 0-16z"/>',
  history: '<path d="M3 11a8 8 0 1 0 3-6M3 4v4h4M11 7v4l3 2"/>',
  split: '<path d="M3 4h7v14H3zM12 4h7v14h-7z"/>',
  editor: '<path d="M3 4h14v14H3z"/>',
  preview: '<path d="M5 4h8v14H5zM16 8l3 3-3 3"/>',
  export: '<path d="M11 3v9M8 9l3 3 3-3M4 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>',
}

/** 快速格式按钮（图标化，覆盖最高频操作） */
const quickButtons: {
  icon: IconName
  title: string
  action: () => void
}[] = [
  { icon: 'bold', title: '粗体', action: () => emit('wrap', '**', '**') },
  { icon: 'italic', title: '斜体', action: () => emit('wrap', '*', '*') },
  { icon: 'strike', title: '删除线', action: () => emit('wrap', '~~', '~~') },
  { icon: 'quote', title: '引用', action: () => emit('insert', '\n> ') },
  { icon: 'code', title: '行内代码', action: () => emit('wrap', '`', '`') },
  { icon: 'codeblock', title: '代码块', action: () => emit('insert', '\n```js\n\n```\n') },
  { icon: 'ul', title: '无序列表', action: () => emit('insert', '\n- ') },
  { icon: 'ol', title: '有序列表', action: () => emit('insert', '\n1. ') },
  { icon: 'link', title: '链接', action: () => emit('insert', '[标题](https://)') },
  { icon: 'image', title: '图片', action: () => emit('insert', '![描述](https://)') },
]

interface MenuItem {
  label: string
  action: () => void
}
interface MenuGroup {
  name: string
  items: MenuItem[]
}

const menus: MenuGroup[] = [
  {
    name: '标题',
    items: [
      { label: '一级标题', action: () => emit('insert', '\n# ') },
      { label: '二级标题', action: () => emit('insert', '\n## ') },
      { label: '三级标题', action: () => emit('insert', '\n### ') },
    ],
  },
  {
    name: '编辑',
    items: [
      { label: '粗体', action: () => emit('wrap', '**', '**') },
      { label: '斜体', action: () => emit('wrap', '*', '*') },
      { label: '删除线', action: () => emit('wrap', '~~', '~~') },
      { label: '引用', action: () => emit('insert', '\n> ') },
      { label: '行内代码', action: () => emit('wrap', '`', '`') },
      { label: '代码块', action: () => emit('insert', '\n```js\n\n```\n') },
      { label: '无序列表', action: () => emit('insert', '\n- ') },
      { label: '有序列表', action: () => emit('insert', '\n1. ') },
      { label: '链接', action: () => emit('insert', '[标题](https://)') },
      { label: '图片', action: () => emit('insert', '![描述](https://)') },
      { label: '表格', action: () => emit('insert', '\n| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |\n') },
      { label: '分割线', action: () => emit('insert', '\n\n---\n\n') },
    ],
  },
]


const openMenu = ref<string | null>(null)
const currentView = ref<'split' | 'editor' | 'preview'>('split')

function toggleMenu(name: string) {
  openMenu.value = openMenu.value === name ? null : name
}
function closeMenus() {
  openMenu.value = null
}
function runItem(fn: () => void) {
  fn()
  closeMenus()
}
function onSetView(mode: 'split' | 'editor' | 'preview') {
  currentView.value = mode
  emit('set-view', mode)
}

onMounted(() => document.addEventListener('click', closeMenus))
onUnmounted(() => document.removeEventListener('click', closeMenus))
</script>

<template>
  <div class="toolbar">
    <!-- 菜单区 -->
    <div class="menu-group">
      <div v-for="menu in menus" :key="menu.name" class="menu">
        <button
          class="menu-btn"
          :class="{ open: openMenu === menu.name }"
          @click.stop="toggleMenu(menu.name)"
        >
          {{ menu.name }}
          <span class="caret">▾</span>
        </button>
        <div v-if="openMenu === menu.name" class="menu-dropdown" @click.stop>
          <button
            v-for="item in menu.items"
            :key="item.label"
            class="menu-item"
            @click="runItem(item.action)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
    </div>

    <span class="divider"></span>

    <!-- 快速格式按钮（图标化） -->
    <button
      v-for="btn in quickButtons"
      :key="btn.title"
      class="tb-btn icon-btn"
      :title="btn.title"
      @click="btn.action"
    >
      <svg class="ic" viewBox="0 0 22 22" v-html="icons[btn.icon]" />
    </button>

    <span class="spacer"></span>

    <!-- 右侧：视图切换 + 主题/历史 -->
    <div class="view-switch">
      <button
        class="tb-btn icon-btn"
        :class="{ active: currentView === 'split' }"
        title="双栏"
        @click="onSetView('split')"
      >
        <svg class="ic" viewBox="0 0 22 22" v-html="icons.split" />
      </button>
      <button
        class="tb-btn icon-btn"
        :class="{ active: currentView === 'editor' }"
        title="仅编辑"
        @click="onSetView('editor')"
      >
        <svg class="ic" viewBox="0 0 22 22" v-html="icons.editor" />
      </button>
      <button
        class="tb-btn icon-btn"
        :class="{ active: currentView === 'preview' }"
        title="仅预览"
        @click="onSetView('preview')"
      >
        <svg class="ic" viewBox="0 0 22 22" v-html="icons.preview" />
      </button>
    </div>
    <button class="tb-btn icon-btn" title="导出 HTML" @click="emit('export')">
      <svg class="ic" viewBox="0 0 22 22" v-html="icons.export" />
    </button>
    <button class="tb-btn icon-btn" title="主题" @click="emit('toggle-theme')">
      <svg class="ic" viewBox="0 0 22 22" v-html="icons.theme" />
    </button>
    <button class="tb-btn icon-btn" title="历史版本" @click="emit('toggle-history')">
      <svg class="ic" viewBox="0 0 22 22" v-html="icons.history" />
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  border-bottom: 1px solid #e5e6eb;
  background: #fff;
  flex-wrap: wrap;
}
.menu-group {
  position: relative;
  display: flex;
  align-items: center;
  gap: 2px;
}
.menu {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background 0.15s ease;
}
.menu-btn:hover,
.menu-btn.open {
  background: #f2f3f5;
}
.caret {
  font-size: 9px;
  color: #999;
}
.menu-dropdown {
  position: absolute;
  top: 32px;
  left: 0;
  z-index: 50;
  min-width: 140px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}
.menu-item {
  text-align: left;
  padding: 7px 10px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background 0.12s ease;
}
.menu-item:hover {
  background: #f2f3f5;
}
.divider {
  width: 1px;
  height: 20px;
  background: #e5e6eb;
  margin: 0 4px;
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
  transition: background 0.15s ease, color 0.15s ease;
}
.tb-btn:hover {
  background: #f2f3f5;
}
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
.icon-btn.active {
  background: #e8f9ef;
  color: #07c160;
}
.spacer {
  flex: 1;
}
.view-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  border-left: 1px solid #e5e6eb;
  border-right: 1px solid #e5e6eb;
  margin: 0 4px;
}
</style>
