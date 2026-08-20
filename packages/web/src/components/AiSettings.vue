<script setup lang="ts">
import { computed, ref } from 'vue'
import { AI_PRESETS, getPreset, listModels } from '@typeduck/core'
import { useAiStore } from '../stores/ai'

const emit = defineEmits<{ (e: 'close'): void }>()
const ai = useAiStore()

const preset = computed(() => getPreset(ai.config.providerId))
const showKey = ref(false)

/** 模型下拉：预设推荐 + 接口拉取的完整列表 */
const fetchedModels = ref<string[]>([])
const modelOptions = computed(() => {
  const list = [...new Set([...preset.value.models, ...fetchedModels.value])]
  return list.length ? list : [ai.config.model]
})

const testing = ref(false)
const testState = ref<'' | 'ok' | 'fail'>('')
const testMsg = ref('')

async function onFetchModels() {
  testing.value = true
  testState.value = ''
  testMsg.value = ''
  try {
    const ids = await listModels({ ...ai.config })
    fetchedModels.value = ids
    testState.value = 'ok'
    testMsg.value = `✓ 连接成功，共 ${ids.length} 个模型`
    if (ids.length && !ids.includes(ai.config.model) && !preset.value.models.includes(ai.config.model)) {
      testMsg.value += `（当前模型 ${ai.config.model} 不在列表中，请确认拼写）`
    }
  } catch (err) {
    testState.value = 'fail'
    testMsg.value = err instanceof Error ? err.message : String(err)
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="ai-overlay" @click.self="emit('close')">
    <div class="ai-dialog">
      <header class="dlg-head">
        <span class="dlg-title">🤖 AI 设置 · BYOK</span>
        <button class="dlg-close" title="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="dlg-body">
        <p class="dlg-intro">
          接入任意 OpenAI 协议兼容的大模型（DeepSeek / 豆包 / 通义千问 / GLM / Kimi / 自定义）。
          <b>你的 API Key 只保存在本机，排版鸭不经过任何服务器。</b>
        </p>

        <label class="fld-label">供应商</label>
        <div class="provider-grid">
          <button
            v-for="p in AI_PRESETS"
            :key="p.id"
            class="provider-card"
            :class="{ active: ai.config.providerId === p.id }"
            @click="ai.applyPreset(p.id)"
          >
            <span class="p-name">{{ p.name }}</span>
            <span v-if="p.note" class="p-note">{{ p.note }}</span>
          </button>
        </div>

        <label class="fld-label">Base URL</label>
        <input v-model="ai.config.baseUrl" class="fld" placeholder="https://api.example.com/v1" spellcheck="false" />

        <label class="fld-label">
          API Key
          <a v-if="preset.keyUrl" :href="preset.keyUrl" target="_blank" rel="noopener" class="key-link">去获取 ↗</a>
        </label>
        <div class="key-row">
          <input
            v-model="ai.config.apiKey"
            class="fld"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
            spellcheck="false"
          />
          <button class="key-toggle" :title="showKey ? '隐藏' : '显示'" @click="showKey = !showKey">
            {{ showKey ? '🙈' : '👁' }}
          </button>
        </div>

        <label class="fld-label">
          模型
          <button class="fetch-btn" :disabled="testing" @click="onFetchModels">
            {{ testing ? '获取中…' : '获取模型列表' }}
          </button>
        </label>
        <input v-model="ai.config.model" class="fld" list="ai-model-options" placeholder="模型名" spellcheck="false" />
        <datalist id="ai-model-options">
          <option v-for="m in modelOptions" :key="m" :value="m" />
        </datalist>
        <p v-if="testMsg" class="test-msg" :data-state="testState">{{ testMsg }}</p>
      </div>

      <footer class="dlg-foot">
        <span class="foot-hint">⚠ Key 存于浏览器 localStorage，请勿在公用电脑上使用</span>
        <button class="foot-done" @click="emit('close')">完成</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.ai-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ai-dialog {
  width: 480px;
  max-width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}
.dlg-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.dlg-title {
  font-size: 15px;
  font-weight: 700;
  color: #1d2129;
}
.dlg-close {
  border: none;
  background: transparent;
  font-size: 14px;
  color: #999;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.dlg-close:hover {
  background: #f2f3f5;
  color: #333;
}
.dlg-body {
  padding: 16px 18px;
  overflow-y: auto;
}
.dlg-intro {
  font-size: 12.5px;
  color: #86909c;
  line-height: 1.7;
  margin: 0 0 14px;
  padding: 10px 12px;
  background: #f7f9f8;
  border-radius: 8px;
}
.dlg-intro b {
  color: #07c160;
}
.fld-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #4e5969;
  margin: 14px 0 6px;
}
.provider-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.provider-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.provider-card:hover {
  border-color: #b9e6cb;
}
.provider-card.active {
  border-color: #07c160;
  background: #f0faf4;
}
.p-name {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
}
.p-note {
  font-size: 11px;
  color: #a3a8b0;
  line-height: 1.4;
}
.fld {
  width: 100%;
  height: 34px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
}
.fld:focus {
  border-color: #07c160;
}
.key-row {
  display: flex;
  gap: 6px;
}
.key-toggle {
  width: 40px;
  height: 34px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  flex-shrink: 0;
}
.key-toggle:hover {
  background: #f2f3f5;
}
.key-link {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: #07c160;
  text-decoration: none;
}
.key-link:hover {
  text-decoration: underline;
}
.fetch-btn {
  margin-left: auto;
  height: 24px;
  padding: 0 10px;
  border: 1px solid #07c160;
  border-radius: 6px;
  background: #fff;
  color: #07c160;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.fetch-btn:hover {
  background: #f0faf4;
}
.fetch-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.test-msg {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.5;
}
.test-msg[data-state='ok'] {
  color: #07c160;
}
.test-msg[data-state='fail'] {
  color: #e5554e;
}
.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 18px;
  border-top: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.foot-hint {
  font-size: 11.5px;
  color: #c0c4cc;
}
.foot-done {
  height: 32px;
  padding: 0 20px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
.foot-done:hover {
  background: #06ad56;
}
</style>
