<script setup lang="ts">
import type { DocHistory } from '../db'

defineProps<{ history: DocHistory[] }>()

const emit = defineEmits<{
  (e: 'restore', entry: DocHistory): void
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
    <div class="panel-header">
      <span>历史版本（最近 30 版）</span>
      <button class="close-btn" @click="emit('close')">✕</button>
    </div>
    <div class="panel-body">
      <div v-if="history.length === 0" class="empty">
        暂无历史版本，编辑过程中会自动保存快照
      </div>
      <div v-for="entry in history" :key="entry.id" class="history-item">
        <div class="history-info">
          <div class="history-title">{{ entry.title || '无标题文档' }}</div>
          <div class="history-time">{{ formatTime(entry.savedAt) }}</div>
        </div>
        <button class="restore-btn" @click="emit('restore', entry)">恢复</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  width: 280px;
  border-left: 1px solid #e5e6eb;
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  font-weight: 600;
  font-size: 13px;
  border-bottom: 1px solid #e5e6eb;
}
.close-btn {
  border: none;
  background: transparent;
  cursor: pointer;
  color: #999;
  font-size: 13px;
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
.restore-btn {
  border: 1px solid #07c160;
  color: #07c160;
  background: transparent;
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}
.restore-btn:hover {
  background: #e7f7ee;
}
</style>
