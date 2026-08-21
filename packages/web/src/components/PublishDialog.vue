<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  getWechatAccessToken,
  publishWechatDraft,
  streamChat,
  uploadWechatCover,
  withImportant,
  type WechatCoverFile,
} from '@typeduck/core'
import { useEditorStore } from '../stores/editor'
import { useAiStore } from '../stores/ai'

const emit = defineEmits<{ (e: 'close'): void }>()
const editor = useEditorStore()
const aiStore = useAiStore()

const CONFIG_STORE = 'typeduck:wechat'

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORE)
    if (raw) return { appId: '', appSecret: '', ...JSON.parse(raw) }
  } catch {
    /* 损坏按未配置处理 */
  }
  return { appId: '', appSecret: '' }
}

/* ---------- 开发者配置 ---------- */

const cfg = ref(loadConfig())
const appIdInput = ref(cfg.value.appId)
const appSecretInput = ref(cfg.value.appSecret)
const showConfig = ref(!cfg.value.appId)
const testing = ref(false)
const testMsg = ref('')
const testState = ref<'' | 'ok' | 'fail'>('')

const configured = computed(() => !!cfg.value.appId && !!cfg.value.appSecret)

function wechatRequest(url: string, init: { method?: string; headers?: Record<string, string>; body?: ArrayBuffer | string }) {
  if (!window.desktopAPI?.request) {
    throw new Error('微信接口不支持浏览器直连（跨域 + IP 白名单），请使用桌面版操作')
  }
  return window.desktopAPI.request(url, init)
}

async function saveConfig() {
  if (!appIdInput.value.trim() || !appSecretInput.value.trim()) {
    testState.value = 'fail'
    testMsg.value = 'AppID 和 AppSecret 都要填'
    return
  }
  cfg.value = { appId: appIdInput.value.trim(), appSecret: appSecretInput.value.trim() }
  localStorage.setItem(CONFIG_STORE, JSON.stringify(cfg.value))
  testState.value = ''
  testMsg.value = ''
}

async function testConnection() {
  await saveConfig()
  testing.value = true
  testMsg.value = ''
  try {
    await getWechatAccessToken(cfg.value, wechatRequest, true)
    testState.value = 'ok'
    testMsg.value = '✓ 连接成功，配置已保存'
  } catch (err) {
    testState.value = 'fail'
    testMsg.value = err instanceof Error ? err.message : String(err)
  } finally {
    testing.value = false
  }
}

/* ---------- 发布表单 ---------- */

const doc = computed(() => editor.activeDoc)
const title = computed(() => doc.value?.title?.trim() || '')
const author = ref(editor.accountName || '')
const digest = ref('')
const cover = ref<{ name: string; type: string; bytes: ArrayBuffer; dataUrl: string } | null>(null)

const step = ref<'idle' | 'working' | 'done'>('idle')
const stepLabel = ref('')
const error = ref('')

async function pickCover(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!/^image\/(jpeg|png|gif|bmp)$/.test(file.type)) {
    error.value = '封面仅支持 jpg / png / gif / bmp'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    error.value = '封面图片不能超过 10MB'
    return
  }
  const bytes = await file.arrayBuffer()
  cover.value = {
    name: file.name,
    type: file.type,
    bytes,
    dataUrl: URL.createObjectURL(file),
  }
  error.value = ''
}

/* AI 摘要：复用 BYOK 配置直接生成 */
const digesting = ref(false)
async function genDigest() {
  if (!aiStore.isConfigured) {
    editor.showToast('AI 生成摘要需要先配置 AI')
    return
  }
  if (!doc.value || doc.value.content.trim().length < 50) {
    editor.showToast('正文太短，不用摘要了吧')
    return
  }
  digesting.value = true
  try {
    const text = await streamChat(aiStore.config, [
      {
        role: 'system',
        content:
          '你是公众号摘要写手。基于文章内容写一条不超过 120 字的摘要：概括核心信息，语气与正文一致，不要「本文介绍了」式套话，不加引号不解释不换行，直接输出摘要文本。',
      },
      { role: 'user', content: `文档标题：${title.value}\n\n正文：\n\n${doc.value.content.slice(0, 6000)}` },
    ])
    digest.value = text.trim().slice(0, 120)
  } catch (err) {
    editor.showToast(err instanceof Error ? err.message : 'AI 生成失败')
  } finally {
    digesting.value = false
  }
}

async function publish() {
  error.value = ''
  if (title.value.length > 64) {
    error.value = `标题超长（${title.value.length}/64 字），先改短一点`
    return
  }
  if (!doc.value || doc.value.content.trim().length < 30) {
    error.value = '正文是空的，发个寂寞？'
    return
  }
  if (!cover.value) {
    error.value = '请选择封面图片（配图助手里裁好的 900×383 正合适）'
    return
  }
  step.value = 'working'
  try {
    stepLabel.value = '正在获取 access_token…'
    const contentHtml = `<section style="${withImportant(editor.theme.styles.root)}">${editor.renderedHtml}</section>`
    const coverFile: WechatCoverFile = { name: cover.value.name, type: cover.value.type, bytes: cover.value.bytes }

    stepLabel.value = '正在上传封面…'
    const uploaded = await uploadWechatCover(cfg.value, wechatRequest, coverFile)

    stepLabel.value = '正在创建草稿…'
    await publishWechatDraft(cfg.value, wechatRequest, {
      title: title.value,
      author: author.value.trim(),
      digest: digest.value.trim(),
      contentHtml,
      thumbMediaId: uploaded.mediaId,
    })
    step.value = 'done'
  } catch (err) {
    step.value = 'idle'
    error.value = err instanceof Error ? err.message : String(err)
  }
}
</script>

<template>
  <div class="pub-overlay">
    <div class="pub-dialog">
      <header class="dlg-head">
        <span class="dlg-title">📤 发布到公众号草稿箱</span>
        <button class="dlg-close" title="关闭" @click="emit('close')">✕</button>
      </header>

      <div class="dlg-body">
        <!-- 开发者配置 -->
        <div v-if="showConfig" class="cfg-form">
          <p class="cfg-intro">
            填写公众号的开发者信息（后台「设置与开发 → 基本配置」里获取）。信息只存本机；
            首次使用需把本机 IP 加入后台的 IP 白名单，点「测试连接」会告诉你怎么做。
          </p>
          <label>AppID</label>
          <input v-model="appIdInput" placeholder="如 wx1234567890abcdef" spellcheck="false" />
          <label>AppSecret</label>
          <input v-model="appSecretInput" type="password" placeholder="开发者密码" spellcheck="false" />
          <div class="cfg-ops">
            <button class="test-btn" :disabled="testing" @click="testConnection">
              {{ testing ? '测试中…' : '保存并测试连接' }}
            </button>
            <button v-if="configured" class="cancel-btn" @click="showConfig = false">返回发布</button>
          </div>
          <p v-if="testMsg" class="test-msg" :data-state="testState">{{ testMsg }}</p>
        </div>

        <!-- 发布表单 -->
        <template v-else>
          <!-- 完成态 -->
          <div v-if="step === 'done'" class="done-box">
            <div class="done-icon">✅</div>
            <p class="done-title">草稿已创建</p>
            <p class="done-desc">
              去公众号后台「内容与互动 → 草稿箱」查看，预览确认后手动发布——<br />发布这一步留给你，工具不替你拍板。
            </p>
            <button class="primary" @click="emit('close')">好的</button>
          </div>

          <!-- 表单态 -->
          <template v-else>
            <div class="fld-row">
              <label class="fld-label">标题</label>
              <span class="fld-value" :class="{ warn: title.length > 64 }">{{ title || '（文档没有标题，先去起一个）' }}（{{ title.length }}/64）</span>
            </div>

            <label class="fld-label">作者</label>
            <input v-model="author" class="fld" placeholder="显示在作者栏" />

            <label class="fld-label">
              摘要（{{ digest.length }}/120，可留空）
              <button class="mini-ai" :disabled="digesting" @click="genDigest">
                {{ digesting ? 'AI 生成中…' : '✨ AI 生成' }}
              </button>
            </label>
            <textarea v-model="digest" class="fld" rows="3" maxlength="120" placeholder="发布时的摘要栏内容"></textarea>

            <label class="fld-label">封面图片（必填）</label>
            <div class="cover-row">
              <img v-if="cover" :src="cover.dataUrl" class="cover-preview" alt="封面预览" />
              <div v-else class="cover-empty">900×383<br />(2.35:1)</div>
              <div class="cover-ops">
                <label class="pick-btn">
                  选择图片
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/bmp" hidden @change="pickCover" />
                </label>
                <p class="cover-hint">建议用配图助手的「封面」裁剪导出</p>
              </div>
            </div>

            <p v-if="error" class="error-msg">{{ error }}</p>

            <p v-if="step === 'working'" class="working">{{ stepLabel }}</p>
          </template>
        </template>
      </div>

      <footer v-if="!showConfig && step !== 'done'" class="dlg-foot">
        <button class="ghost" title="修改开发者配置" @click="showConfig = true">⚙ 公众号配置</button>
        <button class="primary" :disabled="step === 'working'" @click="publish">
          {{ step === 'working' ? '发布中…' : '发布到草稿箱' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.pub-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.pub-dialog {
  width: 460px;
  max-width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.22);
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

/* 配置态 */
.cfg-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cfg-intro {
  font-size: 12.5px;
  color: #86909c;
  line-height: 1.7;
  margin: 0 0 4px;
  padding: 10px 12px;
  background: #f7f9f8;
  border-radius: 8px;
}
.cfg-form label {
  font-size: 12.5px;
  font-weight: 600;
  color: #4e5969;
}
.cfg-form input {
  height: 34px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  font-family: Menlo, Consolas, monospace;
}
.cfg-form input:focus {
  border-color: #07c160;
}
.cfg-ops {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.test-btn {
  height: 32px;
  padding: 0 16px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.test-btn:hover {
  background: #06ad56;
}
.test-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.cancel-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12.5px;
  cursor: pointer;
}
.test-msg {
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
.test-msg[data-state='ok'] {
  color: #07c160;
}
.test-msg[data-state='fail'] {
  color: #e5554e;
}

/* 表单态 */
.fld-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.fld-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: #4e5969;
  margin: 12px 0 6px;
}
.fld-row .fld-label {
  margin: 0;
  flex-shrink: 0;
}
.fld-value {
  font-size: 13px;
  color: #1d2129;
  word-break: break-all;
}
.fld-value.warn {
  color: #e5554e;
}
.fld {
  width: 100%;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  padding: 8px 10px;
  font-size: 13px;
  color: #1d2129;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
}
.fld:focus {
  border-color: #07c160;
}
textarea.fld {
  resize: vertical;
  line-height: 1.6;
}
.mini-ai {
  margin-left: auto;
  height: 24px;
  padding: 0 10px;
  border: 1px solid #b9e6cb;
  border-radius: 6px;
  background: #f0faf4;
  color: #07c160;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.mini-ai:disabled {
  opacity: 0.6;
  cursor: default;
}

/* 封面 */
.cover-row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cover-preview {
  width: 156px;
  height: 66px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #e5e6eb;
}
.cover-empty {
  width: 156px;
  height: 66px;
  border: 1px dashed #cfd4da;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 11px;
  color: #a8adb5;
  line-height: 1.5;
}
.cover-ops {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pick-btn {
  align-self: flex-start;
  height: 30px;
  padding: 0 14px;
  border: 1px solid #e5e6eb;
  border-radius: 7px;
  background: #fff;
  color: #4e5969;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.pick-btn:hover {
  border-color: #07c160;
  color: #07c160;
}
.cover-hint {
  font-size: 11px;
  color: #a8adb5;
}

.error-msg {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: #e5554e;
  line-height: 1.6;
}
.working {
  margin: 12px 0 0;
  font-size: 12.5px;
  color: #409eff;
}

/* 完成态 */
.done-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 0 8px;
  text-align: center;
}
.done-icon {
  font-size: 40px;
}
.done-title {
  font-size: 16px;
  font-weight: 700;
  color: #1d2129;
  margin: 0;
}
.done-desc {
  font-size: 12.5px;
  color: #86909c;
  line-height: 1.8;
  margin: 0 0 8px;
}

.dlg-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid #e5e6eb;
  flex-shrink: 0;
}
.ghost {
  border: none;
  background: transparent;
  color: #86909c;
  font-size: 12.5px;
  cursor: pointer;
}
.ghost:hover {
  color: #07c160;
}
.primary {
  height: 32px;
  padding: 0 20px;
  border: none;
  border-radius: 7px;
  background: #07c160;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.primary:hover {
  background: #06ad56;
}
.primary:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
