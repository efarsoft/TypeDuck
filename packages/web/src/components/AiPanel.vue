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
  (e: 'run-custom', instruction: string): void
  (e: 'run-outline', topic: string, style: string): void
  (e: 'run-digest'): void
  (e: 'run-theme', description: string, template: string): void
  (e: 'run-rewrite', url: string, instruction: string): void
  (e: 'run-rewrite-text', url: string, text: string, instruction: string): void
  (e: 'save-theme'): void
  (e: 'discard'): void
}>()

/* ---------- 空态：功能菜单与内联表单 ---------- */

const mode = ref<'menu' | 'custom' | 'outline' | 'theme' | 'rewrite'>('menu')
const customText = ref('')
const outlineTopic = ref('')
const outlineStyle = ref('通用')
const themeDesc = ref('')
const themeTemplate = ref('clean')
const rewriteUrl = ref('')
const rewriteStyle = ref('')
/** 粘贴模式：自动抓取失败时出现正文输入区 */
const pasteMode = ref(false)
const pasteText = ref('')

const outlineStyles = ['通用', '技术教程', '观点评论', '故事叙事']
const themeTemplates = [
  { id: 'clean', name: '简洁' },
  { id: 'card', name: '卡片强调' },
  { id: 'literary', name: '文艺留白' },
]

/** 任务收起后回到功能菜单 */
watch(
  () => props.task,
  (t) => {
    if (!t) mode.value = 'menu'
  },
)

function submitCustom() {
  if (customText.value.trim()) emit('run-custom', customText.value.trim())
}
function submitOutline() {
  if (outlineTopic.value.trim()) emit('run-outline', outlineTopic.value.trim(), outlineStyle.value)
}
function submitTheme() {
  if (themeDesc.value.trim()) emit('run-theme', themeDesc.value.trim(), themeTemplate.value)
}
function submitRewrite() {
  if (rewriteUrl.value.trim()) emit('run-rewrite', rewriteUrl.value.trim(), rewriteStyle.value.trim())
}

function submitRewritePaste() {
  const text = pasteText.value.trim()
  if (!text) return
  emit('run-rewrite-text', rewriteUrl.value.trim() || '(手动粘贴)', text, rewriteStyle.value.trim())
}

/** 自动抓取失败时切入粘贴模式（App 调用）：保留链接，引导新窗口打开原文复制正文 */
function openRewritePaste(url: string, instruction?: string) {
  mode.value = 'rewrite'
  if (url) rewriteUrl.value = url
  if (instruction) rewriteStyle.value = instruction
  pasteMode.value = true
  pasteText.value = ''
}

defineExpose({ openRewritePaste })

/* ---------- 任务展示 ---------- */

const scrollEl = ref<HTMLElement>()
const statusLabel = computed(
  () => ({ streaming: '生成中…', done: '已完成', error: '出错' })[props.task?.status ?? 'streaming'],
)
const titles = computed(() =>
  props.task?.action === 'titles' && props.task.status === 'done' ? parseTitles(props.task.text) : [],
)

/** 主题预览色板：从编译后的 Theme 样式里提取签名色 */
const palette = computed<string[]>(() => {
  const theme = props.task?.theme
  if (!theme) return []
  const pick = (style: string | undefined, prop: string) =>
    style?.match(new RegExp(`${prop}:\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))`))?.[1] ?? ''
  const colors = [
    pick(theme.styles.a, 'color'),
    pick(theme.styles.h2, 'border-left') || pick(theme.styles.h2, 'background'),
    pick(theme.styles.blockquote, 'border-left'),
    pick(theme.styles.root, 'color'),
    theme.previewBackground,
  ]
  return [...new Set(colors)].filter(Boolean).slice(0, 5)
})

/* 摘要复制（file:// 下 clipboard API 可能受限，命令兜底） */
const copied = ref(false)
async function copyDigest() {
  const text = props.task?.text ?? ''
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

/** 流式输出自动滚到底部 */
watch(
  () => props.task?.text,
  () =>
    nextTick(() => {
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
    <!-- 空态：功能菜单 / 内联表单 -->
    <template v-if="!task">
      <div v-if="mode === 'menu'" class="menu-grid">
        <button class="menu-card" @click="mode = 'custom'">
          <span class="mc-icon">✏️</span>
          <span class="mc-name">自定义指令</span>
          <span class="mc-desc">对选中文字执行任意指令</span>
        </button>
        <button class="menu-card" @click="mode = 'outline'">
          <span class="mc-icon">🧭</span>
          <span class="mc-name">生成大纲</span>
          <span class="mc-desc">一句话主题变文章骨架</span>
        </button>
        <button class="menu-card" @click="emit('run-digest')">
          <span class="mc-icon">📄</span>
          <span class="mc-name">生成摘要</span>
          <span class="mc-desc">公众号摘要栏，120 字以内</span>
        </button>
        <button class="menu-card" @click="mode = 'theme'">
          <span class="mc-icon">🎨</span>
          <span class="mc-name">AI 生成主题</span>
          <span class="mc-desc">描述风格，即刻拥有</span>
        </button>
        <button class="menu-card" @click="mode = 'rewrite'">
          <span class="mc-icon">🔗</span>
          <span class="mc-name">链接改写</span>
          <span class="mc-desc">粘贴文章链接，AI 改写成初稿</span>
        </button>
      </div>
      <p v-if="mode === 'menu'" class="dim">
        选中文字后，工具栏的 AI 润色 / AI 扩写 / AI 缩写 / AI 续写 随时可用；上方 ✨ 生成标题。BYOK：用你自己的
        Key，内容不经过任何服务器。
      </p>

      <div v-else-if="mode === 'custom'" class="form">
        <button class="back" @click="mode = 'menu'">← 返回</button>
        <label>你的指令（先在编辑器选中文字）</label>
        <textarea v-model="customText" rows="3" placeholder="例如：改成小红书风格，多加 emoji；或：把这段改得更犀利"></textarea>
        <button class="run" @click="submitCustom">执 行</button>
      </div>

      <div v-else-if="mode === 'outline'" class="form">
        <button class="back" @click="mode = 'menu'">← 返回</button>
        <label>文章主题</label>
        <input v-model="outlineTopic" placeholder="例如：普通人如何用 AI 做副业" @keyup.enter="submitOutline" />
        <label>风格</label>
        <select v-model="outlineStyle">
          <option v-for="s in outlineStyles" :key="s">{{ s }}</option>
        </select>
        <button class="run" @click="submitOutline">生成大纲</button>
      </div>

      <div v-else-if="mode === 'rewrite'" class="form">
        <button class="back" @click="mode = 'menu'">← 返回</button>
        <label>文章链接</label>
        <input v-model="rewriteUrl" placeholder="https:// 任意文章地址（公众号/博客/新闻）" @keyup.enter="submitRewrite" />
        <label>风格要求（可选）</label>
        <input v-model="rewriteStyle" placeholder="例如：口语化一点，面向职场新人" @keyup.enter="submitRewrite" />

        <!-- 粘贴模式：自动抓取失败时出现 -->
        <template v-if="pasteMode">
          <label>正文（自动抓取失败，请粘贴）</label>
          <a
            class="open-link"
            :href="rewriteUrl"
            target="_blank"
            rel="noopener"
            title="在新窗口打开原文"
          >
            ↗ 新窗口打开原文，全选复制正文粘贴到下面
          </a>
          <textarea
            v-model="pasteText"
            rows="7"
            placeholder="把原文正文粘贴到这里，然后点下方按钮改写…"
          ></textarea>
          <button class="run" :disabled="!pasteText.trim()" @click="submitRewritePaste">
            改写粘贴的正文
          </button>
        </template>
        <button v-else class="run" @click="submitRewrite">抓取并改写</button>

        <p class="dim">抓取原文 → AI 改写为全新初稿（保留事实、重写表达），自动注明原文出处。</p>
      </div>

      <div v-else class="form">
        <button class="back" @click="mode = 'menu'">← 返回</button>
        <label>描述你想要的风格</label>
        <textarea
          v-model="themeDesc"
          rows="3"
          placeholder="例如：莫兰迪灰绿，安静的杂志感，衬线标题"
        ></textarea>
        <label>布局模板</label>
        <select v-model="themeTemplate">
          <option v-for="t in themeTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <button class="run" @click="submitTheme">生成主题</button>
      </div>
    </template>

    <!-- 任务态 -->
    <template v-else>
      <div class="task-head">
        <span class="task-label">{{ AI_ACTIONS[task.action].label }}</span>
        <span class="task-status" :data-s="task.status">{{ statusLabel }}</span>
      </div>

      <!-- 生成主题：进度 / 预览卡 -->
      <template v-if="task.action === 'theme'">
        <div v-if="task.status === 'streaming'" class="theme-progress">
          <span class="spinner"></span>
          正在设计主题…（已接收 {{ task.text.length }} 字符）
        </div>
        <template v-else-if="task.status === 'done' && task.theme">
          <div class="theme-preview" :style="{ background: task.theme.previewBackground }">
            <div class="tp-name">{{ task.theme.name }}</div>
            <div class="tp-desc">{{ task.theme.description }}</div>
            <div class="tp-palette">
              <span v-for="(c, i) in palette" :key="i" :style="{ background: c }"></span>
            </div>
          </div>
          <div class="task-actions">
            <button class="act primary" @click="emit('save-theme')">保存并应用</button>
            <button class="act" @click="emit('retry')">重新生成</button>
            <button class="act" @click="emit('discard')">放弃</button>
          </div>
        </template>
        <template v-else>
          <pre class="stream err">{{ task.text }}</pre>
          <div class="task-actions">
            <button class="act" @click="emit('retry')">重试</button>
            <button class="act" @click="emit('open-settings')">打开设置</button>
          </div>
        </template>
      </template>

      <!-- 摘要：结果 + 字数 + 复制 -->
      <template v-else-if="task.action === 'digest'">
        <pre v-if="task.status !== 'error'" class="stream">{{ task.text
        }}<span v-if="task.status === 'streaming'" class="cursor"></span></pre>
        <pre v-else class="stream err">{{ task.text }}</pre>
        <div v-if="task.status === 'streaming'" class="task-actions">
          <button class="act" @click="emit('stop')">■ 停止</button>
        </div>
        <div v-else-if="task.status === 'done'" class="task-actions">
          <span class="digest-count">{{ task.text.length }} 字</span>
          <button class="act primary" @click="copyDigest">{{ copied ? '已复制 ✓' : '复制摘要' }}</button>
          <button class="act" @click="emit('retry')">重新生成</button>
        </div>
        <div v-else class="task-actions">
          <button class="act" @click="emit('retry')">重试</button>
          <button class="act" @click="emit('open-settings')">打开设置</button>
        </div>
      </template>

      <!-- 标题候选 -->
      <template v-else-if="task.action === 'titles'">
        <div v-if="titles.length" class="title-list">
          <button v-for="(t, i) in titles" :key="i" class="title-item" @click="emit('use-title', t)">
            {{ t }}
          </button>
          <p class="dim">点击任意一条直接应用为文档标题</p>
          <div class="task-actions">
            <button class="act" @click="emit('retry')">重新生成</button>
          </div>
        </div>
        <template v-else-if="task.status !== 'error'">
          <pre class="stream">{{ task.text }}<span v-if="task.status === 'streaming'" class="cursor"></span></pre>
          <div class="task-actions">
            <button v-if="task.status === 'streaming'" class="act" @click="emit('stop')">■ 停止</button>
            <button v-else class="act" @click="emit('retry')">重新生成</button>
          </div>
        </template>
        <template v-else>
          <pre class="stream err">{{ task.text }}</pre>
          <div class="task-actions">
            <button class="act" @click="emit('retry')">重试</button>
            <button class="act" @click="emit('open-settings')">打开设置</button>
          </div>
        </template>
      </template>

      <!-- 通用文本结果：润色/扩写/缩写/续写/自定义指令/大纲 -->
      <template v-else>
        <pre v-if="task.status !== 'error'" class="stream">{{ task.text
        }}<span v-if="task.status === 'streaming'" class="cursor"></span></pre>
        <pre v-else class="stream err">{{ task.text }}</pre>
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

/* 功能菜单 */
.menu-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.menu-card {
  display: grid;
  grid-template-columns: 30px 1fr;
  grid-template-rows: auto auto;
  column-gap: 10px;
  align-items: center;
  padding: 11px 12px;
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.menu-card:hover {
  border-color: #07c160;
  background: #f0faf4;
  transform: translateY(-1px);
}
.mc-icon {
  grid-row: 1 / 3;
  font-size: 20px;
}
.mc-name {
  font-size: 13px;
  font-weight: 700;
  color: #1d2129;
}
.mc-desc {
  font-size: 11.5px;
  color: #a8adb5;
  margin-top: 2px;
}
.dim {
  font-size: 12px;
  color: #a8adb5;
  line-height: 1.7;
  margin-top: 12px;
}

/* 内联表单 */
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.back {
  align-self: flex-start;
  border: none;
  background: transparent;
  color: #86909c;
  font-size: 12.5px;
  cursor: pointer;
  padding: 2px 0;
}
.back:hover {
  color: #07c160;
}
.form label {
  font-size: 12.5px;
  font-weight: 600;
  color: #4e5969;
}
.form textarea,
.form input,
.form select {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s ease;
}
.form textarea:focus,
.form input:focus,
.form select:focus {
  border-color: #07c160;
}
.form textarea {
  resize: vertical;
  line-height: 1.6;
}
.open-link {
  font-size: 12.5px;
  color: #07c160;
  text-decoration: none;
  line-height: 1.6;
}
.open-link:hover {
  text-decoration: underline;
}
.run {
  height: 32px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.run:hover {
  background: #06ad56;
}

/* 任务态 */
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

/* 主题生成 */
.theme-progress {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 12px;
  font-size: 13px;
  color: #4e5969;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #dcdfe6;
  border-top-color: #07c160;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.theme-preview {
  border: 1px solid #e5e6eb;
  border-radius: 10px;
  padding: 18px 16px 14px;
}
.tp-name {
  font-size: 17px;
  font-weight: 800;
  color: #1d2129;
}
.tp-desc {
  font-size: 12px;
  color: #86909c;
  margin: 6px 0 12px;
}
.tp-palette {
  display: flex;
  gap: 6px;
}
.tp-palette span {
  flex: 1;
  height: 22px;
  border-radius: 5px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

/* 标题候选 */
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

/* 摘要 */
.digest-count {
  align-self: center;
  font-size: 12px;
  color: #a8adb5;
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
