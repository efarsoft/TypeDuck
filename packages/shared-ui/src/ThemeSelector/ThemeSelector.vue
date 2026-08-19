<script setup lang="ts">
import { computed } from 'vue'
import { themes } from '@typeduck/core'
import type { Theme, ThemeCategory } from '@typeduck/core'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', id: string): void }>()

const categoryLabels: Record<ThemeCategory, string> = {
  daily: '📝 日常写作',
  expressive: '🎨 个性表达',
  narrative: '🖋 文艺叙事',
}

const grouped = computed(() => {
  const map = new Map<ThemeCategory, Theme[]>()
  for (const theme of themes) {
    if (!map.has(theme.category)) map.set(theme.category, [])
    map.get(theme.category)!.push(theme)
  }
  return [...map.entries()]
})

/** 从内联样式中提取 color / font-weight 值 */
function pickStyle(style: string, prop: string): string {
  const m = style.match(new RegExp(`${prop}:\\s*([^;]+)`))
  return m ? m[1].trim() : ''
}
</script>

<template>
  <div class="theme-selector">
    <div v-for="[category, list] in grouped" :key="category" class="group">
      <div class="group-label">{{ categoryLabels[category] }}</div>
      <div class="theme-list">
        <button
          v-for="theme in list"
          :key="theme.id"
          class="theme-card"
          :class="{ active: theme.id === modelValue }"
          :style="{ background: theme.previewBackground }"
          @click="emit('update:modelValue', theme.id)"
        >
          <!-- 迷你排版预览：标题条 + 两行正文 + 引用块 -->
          <span
            class="mini mini-title"
            :style="{
              color: pickStyle(theme.styles.h2, 'color') || pickStyle(theme.styles.root, 'color'),
              borderBottom: `2px solid ${pickStyle(theme.styles.h2, 'border-left') ? pickStyle(theme.styles.h2, 'border-left').split(' ').pop() : '#eee'}`,
            }"
          >{{ theme.name }}</span>
          <span
            class="mini mini-line"
            :style="{ background: pickStyle(theme.styles.root, 'color') || '#999', opacity: 0.35 }"
          ></span>
          <span
            class="mini mini-line"
            :style="{ background: pickStyle(theme.styles.root, 'color') || '#999', opacity: 0.25, width: 70 }"
          ></span>
          <span
            class="mini mini-quote"
            :style="{
              background: pickStyle(theme.styles.blockquote, 'background') || 'transparent',
              borderLeft: `2px solid ${pickStyle(theme.styles.blockquote, 'border-left')?.split(' ').pop() || '#ccc'}`,
            }"
          ></span>
          <span class="mini-name">{{ theme.name }}</span>
          <span class="mini-desc" :title="theme.description">{{ theme.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-selector {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.group-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 6px;
  letter-spacing: 1px;
}
.theme-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}
.theme-card {
  position: relative;
  border: 2px solid transparent;
  outline: 1px solid #e5e6eb;
  border-radius: 10px;
  padding: 10px 10px 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}
.theme-card.active {
  border-color: #07c160;
}
.mini {
  display: block;
  pointer-events: none;
}
.mini-title {
  font-size: 12px;
  font-weight: 700;
  padding-bottom: 4px;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-line {
  height: 4px;
  border-radius: 2px;
  width: 100%;
}
.mini-quote {
  height: 8px;
  border-radius: 0 3px 3px 0;
  width: 60%;
  opacity: 0.6;
}
.mini-name {
  font-size: 11px;
  color: #555;
  font-weight: 600;
  text-align: left;
  padding-top: 4px;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
}
.mini-desc {
  font-size: 10px;
  color: #999;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
