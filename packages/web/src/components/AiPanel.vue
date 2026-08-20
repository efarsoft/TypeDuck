<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AI_ACTIONS, parseTitles } from '@typeduck/core'
import type { AiTask } from '../stores/ai'

const props = defineProps<{ task: AiTask | null }>()
const emit = defineEmits<{
  (e: 'stop'): void
  (e: 'retry'): void
  (e: 'apply', mode: 'replace' | 'insert'): void
  (e: 'use-title', title: string): void
  (e: 'close'): void
  (e: 'open-settings'): void
}>()

const scrollEl = ref<HTMLElement>()
const statusLabel = computed(
  () => ({ streaming: '生成中…', done: '已完成', error: '出错' })[props.task?.status ?? 'streaming'],
)
const titles = computed(() =>
  props.task?.action === 'titles' && props.task.status === 'done' ? parseTitles(props.task.text) : [],
)

/** 流式输出自动滚到底部 */
watch(
  () => props.task?.text,
  () => nextTick(() => {
    if (scrollEl.value) scrollEl.value.scrollTop = scrollEl.value.scrollHeight
  }),
)
</script>

<template>
  <div class="panel-head">
    <span>AI 助手</span>
    <span class="head-btns">
      <button class="mini-btn" title="AI 设置（BYOK）" @click="emit('open-settings')">⚙</button>
      <button class="mini-btn" title="收起面板" @click="emit('close')">✕</button>
    </span>
  </div>

  <div ref="scrollEl" class="ai-scroll">
    <div v-if="!task" class="ai-empty">
      <p>选中一段文字，点编辑器工具栏的 <b>润色 / 扩写 / 缩写</b>；</p>
      <p>光标停在哪里，<b>续写</b>就从哪里接着写；</p>
      <p>写完正文，点上方 ✨ 让 AI <b>起标题</b>。</p>
      <p class="dim">BYOK 模式：用你自己的 API Key，哪家便宜用哪家，内容不经过任何第三方服务器。</p>
    </div>

    <template v-else>
      <div class="task-head">
        <span class="task-label">{{ AI_ACTIONS[task.action].label }}</span>
        <span class="task-status" :data-s="task.status">{{ statusLabel }}</span>
      </div>

      <!-- 标题候选：点击回填文档标题 -->
      <div v-if="titles.length" class="title-list">
        <button v-for="(t, i) in titles" :key="i" class="title-item" @click="emit('use-title', t)">
          {{ t }}
        </button>
        <p class="dim">点击任意一条直接应用为文档标题</p>
      </div>

      <!-- 正文结果：流式滚动输出 -->
      <pre v-else class="stream" :class="{ err: task.status === 'error' }">{{
        task.status === 'done' && !task.text ? '（空结果，可重新生成）' : task.text
      }}<span v-if="task.status === 'streaming'" class="cursor"></span></pre>

      <div class="task-actions">
        <template v-if="task.status === 'streaming'">
          <button class="act" @click="emit('stop')">■ 停止</button>
        </template>
        <template v-else-if="task.status === 'done'">
          <button v-if="task.range" class="act primary" @click="emit('apply', 'replace')">替换选区</button>
          <button class="act" :class="{ primary: !task.range }" @click="emit('apply', 'insert')">插入到光标</button>
          <button class="act" @click="emit('retry')">重新生成</button>
        </template>
        <template v-else>
          <button class="act" @click="emit('retry')">重试</button>
          <button class="act" @click="emit('open-settings')">打开设置</button>
        </template>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid #e5e6eb;
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
  flex-shrink: 0;
}
.head-btns {
  display: inline-flex;
  gap: 2px;
}
.mini-btn {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: #999;
  font-size: 13px;
  cursor: pointer;
}
.mini-btn:hover {
  background: #f2f3f5;
  color: #333;
}
.ai-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  min-height: 0;
}
.ai-empty {
  font-size: 13px;
  color: #4e5969;
  line-height: 2;
}
.ai-empty b {
  color: #07c160;
}
.ai-empty .dim,
.dim {
  font-size: 12px;
  color: #a8adb5;
  line-height: 1.7;
  margin-top: 10px;
}
.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.task-label {
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
}
.task-status {
  font-size: 11.5px;
}
.task-status[data-s='streaming'] {
  color: #409eff;
}
.task-status[data-s='done'] {
  color: #07c160;
}
.task-status[data-s='error'] {
  color: #e5554e;
}
.stream {
  margin: 0;
  padding: 12px;
  background: #f7f8fa;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.8;
  color: #1d2129;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  min-height: 60px;
}
.stream.err {
  background: #fdf1f0;
  color: #c4564f;
}
.cursor {
  display: inline-block;
  width: 7px;
  height: 15px;
  margin-left: 2px;
  background: #07c160;
  vertical-align: -2px;
  animation: blink 0.9s step-start infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.title-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.title-item {
  text-align: left;
  padding: 10px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  line-height: 1.5;
  color: #1d2129;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.title-item:hover {
  border-color: #07c160;
  background: #f0faf4;
}
.task-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.act {
  height: 30px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.act:hover {
  border-color: #07c160;
  color: #07c160;
}
.act.primary {
  background: #07c160;
  border-color: #07c160;
  color: #fff;
}
.act.primary:hover {
  background: #06ad56;
}
</style>
