<script setup lang="ts">
import { computed, ref } from 'vue'

const props = defineProps<{ html: string; background: string; rootStyle: string }>()

const scrollEl = ref<HTMLElement>()

/** 预览滚动容器，供双栏同步滚动使用 */
function getScrollEl(): HTMLElement | null {
  return scrollEl.value ?? null
}

const rootHtml = computed(
  () => `<section style="${props.rootStyle}">${props.html}</section>`,
)

defineExpose({ getScrollEl })
</script>

<template>
  <div class="preview">
    <div ref="scrollEl" class="preview-scroll">
      <!-- 手机宽度预览卡片（无外壳，仅保留手机屏宽），预览与复制使用同一份内联样式 HTML -->
      <div class="preview-phone" :style="{ background }">
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
  background: #f0f2f5;
}
.preview-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}
.preview-phone {
  width: 390px; /* 手机屏宽预览 */
  max-width: 100%;
  padding: 20px 16px 32px;
  border-radius: 12px;
  border: 1px solid #e5e6eb;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}
</style>
