<script setup lang="ts">
export interface DocListItem {
  id: string
  title: string
  updatedAt: number
  wordCount: number
}

defineProps<{
  docs: DocListItem[]
  activeId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'create'): void
  (e: 'remove', id: string): void
}>()

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<template>
  <div class="doc-list">
    <div class="doc-list-header">
      <span>我的文档</span>
      <button class="new-btn" title="新建文档" @click="emit('create')">＋</button>
    </div>
    <div class="doc-items">
      <div
        v-for="doc in docs"
        :key="doc.id"
        class="doc-item"
        :class="{ active: doc.id === activeId }"
        @click="emit('select', doc.id)"
      >
        <div class="doc-title">{{ doc.title || '无标题文档' }}</div>
        <div class="doc-meta">
          <span>{{ formatTime(doc.updatedAt) }}</span>
          <span>{{ doc.wordCount }} 字</span>
          <button class="del-btn" title="删除" @click.stop="emit('remove', doc.id)">✕</button>
        </div>
      </div>
      <div v-if="docs.length === 0" class="empty">还没有文档，点击 ＋ 新建</div>
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
}
.doc-items {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}
.doc-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.doc-item:hover {
  background: #f2f3f5;
}
.doc-item.active {
  background: #e7f7ee;
}
.doc-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #999;
  margin-top: 3px;
}
.del-btn {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #bbb;
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}
.del-btn:hover {
  color: #e64340;
}
.empty {
  color: #aaa;
  font-size: 12px;
  text-align: center;
  padding: 20px 0;
}
</style>
