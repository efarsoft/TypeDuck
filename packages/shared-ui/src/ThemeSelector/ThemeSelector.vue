<script setup lang="ts">
import { computed } from 'vue'
import { themes } from '@typeduck/core'
import type { ThemeCategory } from '@typeduck/core'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', id: string): void }>()

const categoryLabels: Record<ThemeCategory, string> = {
  minimal: '简约风',
  tech: '技术风',
  literary: '文艺风',
  design: '设计风',
}

/** 从 root 内联样式中提取文字颜色，作为主题卡文字色（比从 strong 取更稳） */
function themeTextColor(rootStyle: string): string {
  const m = rootStyle.match(/color:\s*(#[0-9a-fA-F]{3,6})/)
  return m ? m[1] : '#333'
}

const grouped = computed(() => {
  const map = new Map<ThemeCategory, typeof themes>()
  for (const theme of themes) {
    if (!map.has(theme.category)) map.set(theme.category, [])
    map.get(theme.category)!.push(theme)
  }
  return [...map.entries()]
})
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
          <span
            class="swatch"
            :style="{ background: theme.previewBackground, color: themeTextColor(theme.styles.root) }"
          >
            {{ theme.name }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.theme-selector {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.group-label {
  font-size: 12px;
  color: #888;
  margin-bottom: 6px;
}
.theme-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.theme-card {
  border: 2px solid #e5e6eb;
  border-radius: 8px;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;
}
.theme-card.active {
  border-color: #07c160; /* 微信绿 */
}
.swatch {
  display: block;
  padding: 10px 16px;
  font-size: 13px;
}
</style>
