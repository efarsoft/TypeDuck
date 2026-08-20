<script setup lang="ts">
import { computed } from 'vue'
import { themes } from '@typeduck/core'
import type { Theme, ThemeCategory } from '@typeduck/core'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', id: string): void
  (e: 'remove-theme', id: string): void
}>()

const categoryLabels: Record<ThemeCategory, string> = {
  daily: '📝 日常写作',
  expressive: '🎨 个性撞色',
  narrative: '🖋 文艺叙事',
  dark: '🌙 深色沉浸',
  ai: '🤖 AI 生成',
}

const grouped = computed(() => {
  const map = new Map<ThemeCategory, Theme[]>()
  for (const theme of themes) {
    if (!map.has(theme.category)) map.set(theme.category, [])
    map.get(theme.category)!.push(theme)
  }
  return [...map.entries()]
})

/** 从内联样式中提取属性值 */
function pickStyle(style: string, prop: string): string {
  const m = style.match(new RegExp(`${prop}:\\s*([^;]+)`))
  return m ? m[1].trim() : ''
}

/** 主题签名色：优先链接色 / 标题色（避开过浅的白），用于卡片顶部色条，强化辨识度 */
function signatureColor(theme: Theme): string {
  const link = pickStyle(theme.styles.a, 'color')
  if (link && !isTooLight(link)) return link
  const h2 = pickStyle(theme.styles.h2, 'color')
  if (h2 && !isTooLight(h2)) return h2
  const h2bg = pickStyle(theme.styles.h2, 'background')
  if (h2bg && h2bg !== 'transparent' && !isTooLight(h2bg)) return h2bg
  const root = pickStyle(theme.styles.root, 'color')
  if (root && !isTooLight(root)) return root
  return '#07c160'
}

/** 迷你标题样式：优先还原主题 h2 的真实形态（含反白色块）；
 *  无底色且文字过浅（如白字主题）时回退到深色，保证在浅色卡片上可见 */
function miniTitleStyle(theme: Theme): Record<string, string> {
  const h2 = theme.styles.h2
  const color = pickStyle(h2, 'color')
  const bg = pickStyle(h2, 'background')
  const borderLeft = pickStyle(h2, 'border-left')?.split(' ').pop()
  const style: Record<string, string> = {}

  if (bg && bg !== 'transparent') {
    // 反白色块标题（经典蓝 / 暖橙）：还原色块 + 白字
    style.background = bg
    style.color = color || '#fff'
    style.padding = '2px 8px'
    style.borderRadius = '3px'
    style.alignSelf = 'flex-start'
    style.borderBottom = 'none'
    return style
  }

  let finalColor = color || pickStyle(theme.styles.root, 'color') || '#333'
  if (isTooLight(finalColor) && isTooLight(theme.previewBackground)) {
    finalColor = pickStyle(theme.styles.root, 'color') || '#333'
    if (isTooLight(finalColor)) finalColor = '#333'
  }
  style.color = finalColor
  style.borderBottom = `2px solid ${borderLeft || '#eee'}`
  return style
}

/** 链接色：从 a 样式取 color，回退签名色 */
function linkColor(theme: Theme): string {
  return pickStyle(theme.styles.a, 'color') || signatureColor(theme)
}

/** 引用块底色（无则透明） */
function quoteBg(theme: Theme): string {
  return pickStyle(theme.styles.blockquote, 'background') || 'transparent'
}

/** 引用块左边色 */
function quoteBorder(theme: Theme): string {
  return pickStyle(theme.styles.blockquote, 'border-left')?.split(' ').pop() || '#ccc'
}

/** 粗略判断颜色是否过浅（白/接近白），用于避免「白字配白底」 */
function isTooLight(color: string): boolean {
  const m = color.match(/#([0-9a-fA-F]{3,6})/)
  if (!m) return false
  let hex = m[1]
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 190
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
            :title="`${theme.name}：${theme.description}`"
            @click="emit('update:modelValue', theme.id)"
          >
            <!-- AI 生成主题可删除；内置主题不可删 -->
            <span
              v-if="theme.category === 'ai'"
              class="card-del"
              title="删除该 AI 主题"
              @click.stop="emit('remove-theme', theme.id)"
              >✕</span
            >
          <!-- 顶部签名色条：一眼区分相似主题 -->
          <span class="mini-accent" :style="{ background: signatureColor(theme) }"></span>
          <!-- 迷你排版预览：标题（还原 h2）+ 正文 + 链接 + 引用 -->
          <span class="mini mini-title" :style="miniTitleStyle(theme)">{{ theme.name }}</span>
          <span
            class="mini mini-line"
            :style="{ background: pickStyle(theme.styles.root, 'color') || '#999', opacity: 0.35 }"
          ></span>
          <span class="mini mini-link" :style="{ color: linkColor(theme) }">链接示例 ↗</span>
          <span
            class="mini mini-quote"
            :style="{ background: quoteBg(theme), borderLeft: `2px solid ${quoteBorder(theme)}` }"
          ></span>
          <span class="mini-desc">{{ theme.description }}</span>
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
  gap: 16px;
}
.group-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
  letter-spacing: 1px;
  font-weight: 600;
}
.theme-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}
.theme-card {
  position: relative;
  overflow: hidden;
  border: 2px solid transparent;
  outline: 1px solid #e5e6eb;
  border-radius: 10px;
  padding: 12px 10px 9px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.theme-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}
.theme-card.active {
  border-color: #07c160;
  outline-color: #07c160;
}
.mini {
  display: block;
  pointer-events: none;
}
.mini-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
}
.card-del {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 2;
}
.theme-card:hover .card-del {
  opacity: 1;
}
.card-del:hover {
  background: #e5554e;
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
.mini-link {
  font-size: 10px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mini-quote {
  height: 8px;
  border-radius: 0 3px 3px 0;
  width: 60%;
  opacity: 0.7;
}
.mini-desc {
  font-size: 10px;
  color: #999;
  font-weight: 500;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  padding-top: 5px;
  border-top: 1px dashed rgba(0, 0, 0, 0.08);
  min-height: 34px; /* 固定两行高度，卡片对齐 */
}
</style>
