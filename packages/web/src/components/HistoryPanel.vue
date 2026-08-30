<script setup lang="ts">
import type { DocHistory } from '../db'

defineProps<{ history: DocHistory[] }>()

const emit = defineEmits<{
  (e: 'restore', entry: DocHistory): void
  (e: 'delete', entry: DocHistory): void
  (e: 'close'): void
}>()

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
</script>

<template>
  <div class="history-panel">
    <div class="panel-body">
      <div v-if="history.length === 0" class="empty">
        暂无历史版本，编辑过程中会自动保存快照
      </div>
      <div v-for="entry in history" :key="entry.id" class="history-item">
        <div class="history-info">
          <div class="history-title">{{ entry.title || '无标题文档' }}</div>
          <div class="history-time">{{ formatTime(entry.savedAt) }}</div>
        </div>
        <div class="history-actions">
          <button class="del-btn" title="删除该版本" @click="emit('delete', entry)">删除</button>
          <button class="restore-btn" @click="emit('restore', entry)">恢复</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.panel-body {
  flex: 1;
  overflow-y: auto;
}
.empty {
  color: #aaa;
  font-size: 12px;
  text-align: center;
  padding: 24px 12px;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid #f2f3f5;
}
.history-info {
  flex: 1;
  min-width: 0;
}
.history-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.history-time {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}
.history-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.del-btn {
  border: 1px solid #efd3d0;
  color: #c44d43;
  background: transparent;
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}
.history-item:hover .del-btn {
  opacity: 1;
}
.del-btn:hover {
  background: #fff4f3;
}
.restore-btn {
  border: 1px solid #07c160;
  color: #07c160;
  background: transparent;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.restore-btn:hover {
  background: #e7f7ee;
}
</style>
