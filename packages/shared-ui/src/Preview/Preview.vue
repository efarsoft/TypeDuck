<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{
  html: string
  background: string
  rootStyle: string
  /** 进阶自定义 CSS（已由调用方加 .td-rich 作用域），仅网页预览路径注入 */
  customCss?: string
  themeName?: string
  articleTitle?: string
  accountName?: string
}>()

const emit = defineEmits<{
  (e: 'open-theme'): void
  (e: 'update:accountName', name: string): void
}>()

const scrollEl = ref<HTMLElement>()

/** 公众号头部日期（进入页面时刻） */
const metaDate = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const dateText = `${metaDate.getFullYear()}-${pad(metaDate.getMonth() + 1)}-${pad(metaDate.getDate())} ${pad(metaDate.getHours())}:${pad(metaDate.getMinutes())}`

/** 公众号名点击编辑 */
const editingAccount = ref(false)
const accountDraft = ref('')
const accountInput = ref<HTMLInputElement>()
watch(editingAccount, async (editing) => {
  if (editing) {
    await nextTick()
    accountInput.value?.focus()
    accountInput.value?.select()
  }
})
function startEditAccount() {
  accountDraft.value = props.accountName || ''
  editingAccount.value = true
}
function commitAccount() {
  editingAccount.value = false
  const name = accountDraft.value.trim()
  if (name && name !== props.accountName) emit('update:accountName', name)
}

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

const rootHtml = computed(() => {
  const styleTag = props.customCss ? `<style>${props.customCss}</style>` : ''
  return `<section class="td-rich" style="${props.rootStyle}">${styleTag}${props.html}</section>`
})

defineExpose({ getScrollEl })
</script>

<template>
  <div class="preview">
    <div class="preview-bar">
      <button class="preview-tag" title="点击切换主题" @click="emit('open-theme')">
        预览<template v-if="themeName"> · {{ themeName }}</template> ▸
      </button>
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
        <!-- 公众号原生头部模拟：标题 + 公众号名 + 日期（点击公众号名可编辑） -->
        <header class="wx-head">
          <h1 class="wx-title">{{ articleTitle || '未命名文档' }}</h1>
          <div class="wx-meta">
            <span class="wx-avatar">🦆</span>
            <input
              v-if="editingAccount"
              ref="accountInput"
              v-model="accountDraft"
              class="wx-account-input"
              maxlength="20"
              @keyup.enter="commitAccount"
              @blur="commitAccount"
            />
            <button v-else class="wx-account" title="点击修改公众号名称" @click="startEditAccount">
              {{ accountName }}
            </button>
            <span class="wx-date">{{ dateText }}</span>
          </div>
        </header>
        <!-- 进阶主题 customCss 已随 rootHtml 一并 v-html 注入（含 .td-rich 作用域）；公众号复制路径不含 -->
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
  border: none;
  background: transparent;
  padding: 2px 6px;
  font-size: 11px;
  color: #999;
  letter-spacing: 1px;
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.15s ease, background 0.15s ease;
}
.preview-tag:hover {
  color: #07c160;
  background: #f0faf4;
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
  padding: 20px 16px 36px;
  border-radius: 12px;
  border: 1px solid #ebecef;
  overflow: hidden;
  transition: width 0.2s ease;
}
/* 公众号原生头部模拟（贴近微信文章页观感） */
.wx-head {
  margin: 4px 4px 18px;
}
.wx-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: rgba(0, 0, 0, 0.88);
  margin: 0 0 14px;
  white-space: normal;      /* 完整换行显示，不截断 */
  word-break: break-word;
  overflow-wrap: anywhere;
}
.wx-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
.wx-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wx-account {
  border: none;
  background: transparent;
  padding: 1px 4px;
  font-size: 13px;
  color: #576b95;
  cursor: pointer;
  border-radius: 4px;
}
.wx-account:hover {
  background: rgba(87, 107, 149, 0.08);
}
.wx-account-input {
  width: 130px;
  border: 1px solid #07c160;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  padding: 1px 4px;
  outline: none;
}
.wx-date {
  margin-left: auto;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.35);
}
</style>
