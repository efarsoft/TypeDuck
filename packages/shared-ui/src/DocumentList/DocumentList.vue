<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface DocListItem {
  id: string
  title: string
  updatedAt: number
  wordCount: number
  /** 该文档当前主题的强调色（小圆点标识用） */
  themeColor?: string
}

const props = defineProps<{
  docs: DocListItem[]
  activeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
  (e: 'remove', id: string): void
}>()

const searchText = ref('')
const openMenuId = ref<string | null>(null)

const filteredDocs = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return props.docs
  return props.docs.filter(
    (d) => (d.title || '无标题文档').toLowerCase().includes(q),
  )
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id
}
function closeMenus() {
  openMenuId.value = null
}
function onRemove(id: string) {
  closeMenus()
  emit('remove', id)
}

onMounted(() => document.addEventListener('click', closeMenus))
onUnmounted(() => document.removeEventListener('click', closeMenus))
</script>

<template>
  <div class="doc-list">
    <div class="doc-list-header">
      <span>我的文档</span>
      <button class="new-btn" title="新建文档" @click="emit('create')">＋</button>
    </div>

    <div class="doc-search">
      <svg class="search-ic" viewBox="0 0 22 22" aria-hidden="true">
        <path d="M9 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM13 13l4 4" />
      </svg>
      <input v-model="searchText" class="search-input" placeholder="搜索文档…" />
    </div>

    <div class="doc-items">
      <div
        v-for="doc in filteredDocs"
        :key="doc.id"
        class="doc-item"
        :class="{ active: doc.id === activeId }"
        @click="emit('select', doc.id)"
      >
        <div class="doc-title">
          <span
            v-if="doc.themeColor"
            class="theme-dot"
            :style="{ background: doc.themeColor }"
          ></span>{{ doc.title || '无标题文档' }}
        </div>
        <div class="doc-meta">
          <span>{{ formatTime(doc.updatedAt) }}</span>
          <span>{{ doc.wordCount }} 字</span>
        </div>
        <button
          class="more-btn"
          title="更多"
          @click.stop="toggleMenu(doc.id)"
        >
          <svg class="more-ic" viewBox="0 0 22 22" aria-hidden="true">
            <path d="M5 9h.01M11 9h.01M17 9h.01" />
          </svg>
        </button>
        <div v-if="openMenuId === doc.id" class="doc-menu" @click.stop>
          <button class="doc-menu-item danger" @click="onRemove(doc.id)">删除</button>
        </div>
      </div>
      <div v-if="filteredDocs.length === 0" class="empty">没有匹配的文档</div>
    </div>
  </div>
</template>

<style scoped>
.doc-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.doc-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-weight: 600;
  border-bottom: 1px solid #e5e6eb;
}
.new-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: #07c160;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s ease;
}
.new-btn:hover {
  background: #06ad56;
}
.doc-search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 10px;
  padding: 0 8px;
  height: 30px;
  background: #f3f4f6;
  border-radius: 6px;
}
.search-ic {
  width: 15px;
  height: 15px;
  stroke: #999;
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #333;
  min-width: 0;
}
.doc-items {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}
.doc-item {
  position: relative;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.doc-item:hover {
  background: #f2f3f5;
}
.doc-item.active {
  background: #e8f9ef;
}
.doc-title {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
}
.theme-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 6px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06) inset;
}
.doc-item.active .doc-title {
  color: #07c160;
}
.doc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #999;
  margin-top: 3px;
}
.more-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  display: none;
  align-items: center;
  justify-content: center;
}
.doc-item:hover .more-btn {
  display: inline-flex;
}
.more-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}
.more-ic {
  width: 16px;
  height: 16px;
  stroke: #888;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
}
.doc-menu {
  position: absolute;
  top: 30px;
  right: 6px;
  z-index: 20;
  min-width: 90px;
  padding: 4px;
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
}
.doc-menu-item {
  width: 100%;
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
.doc-menu-item:hover {
  background: #f2f3f5;
}
.doc-menu-item.danger {
  color: #e64340;
}
.doc-menu-item.danger:hover {
  background: #fdecea;
}
.empty {
  color: #aaa;
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}
</style>
