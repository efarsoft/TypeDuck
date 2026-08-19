<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ html: string; background: string; rootStyle: string }>()

const scrollEl = ref<HTMLElement>()

/** 预览滚动容器，供双栏同步滚动使用 */
function getScrollEl(): HTMLElement | null {
  return scrollEl.value ?? null
}

/** 预览宽度：手机屏宽 / 公众号正文全宽 */
const sizes = [
  { label: '手机', value: 390 },
  { label: '公众号', value: 677 },
] as const
const activeSize = ref<number>(390)

const rootHtml = computed(
  () => `<section style="${props.rootStyle}">${props.html}</section>`,
)

defineExpose({ getScrollEl })
</script>

<template>
  <div class="preview">
    <div class="preview-bar">
      <span class="preview-tag">预览</span>
      <div class="size-switch">
        <button
          v-for="s in sizes"
          :key="s.value"
          class="size-btn"
          :class="{ active: activeSize === s.value }"
          @click="activeSize = s.value"
        >
          {{ s.label }}
        </button>
      </div>
    </div>
    <div ref="scrollEl" class="preview-scroll">
      <!-- 预览与复制使用同一份内联样式 HTML，所见即所得；宽度可切换手机/公众号全宽 -->
      <div
        class="preview-phone"
        :class="{ wide: activeSize === 677 }"
        :style="{ background, width: activeSize + 'px' }"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-html="rootHtml"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview {
  height: 100%;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
}
.preview-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #ebedf0;
  flex-shrink: 0;
}
.preview-tag {
  font-size: 11px;
  color: #bbb;
  letter-spacing: 1px;
}
.size-switch {
  display: inline-flex;
  background: #f2f3f5;
  border-radius: 6px;
  padding: 2px;
}
.size-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #666;
  padding: 3px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.size-btn.active {
  background: #fff;
  color: #07c160;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
.preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.preview-phone {
  max-width: 100%;
  padding: 24px 20px 36px;
  border-radius: 12px;
  border: 1px solid #ebecef;
  overflow: hidden;
  transition: width 0.2s ease;
}
</style>
