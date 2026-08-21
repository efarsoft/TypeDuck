<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { OSS_PRESETS, ossUpload, ossObjectName, type OssConfig } from '@typeduck/core'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const STORE = 'typeduck:oss'
const TEST_KEY = 'typeduck-conn-test.txt'

function load(): OssConfig {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return { provider: 'r2', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '', publicBaseUrl: '', prefix: '', ...JSON.parse(raw) }
  } catch { /* 损坏按未配置 */ }
  return { provider: 'r2', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '', publicBaseUrl: '', prefix: '' }
}

const cfg = ref<OssConfig>(load())
const testing = ref(false)
const testState = ref<'' | 'ok' | 'fail'>('')
const testMsg = ref('')
const showSecret = ref(false)

const configured = computed(() => !!(cfg.value.endpoint && cfg.value.bucket && cfg.value.accessKeyId && cfg.value.secretAccessKey))

function switchProvider(id: string) {
  cfg.value.provider = id
  const preset = OSS_PRESETS.find((p) => p.id === id)
  if (preset && id !== 'custom') cfg.value.region = id === 'r2' ? 'auto' : cfg.value.region
}

async function save() {
  localStorage.setItem(STORE, JSON.stringify(cfg.value))
}

async function test() {
  await save()
  testing.value = true
  testState.value = ''
  testMsg.value = ''
  try {
    // 上传一个极小的文本对象验证签名与 CORS
    const bytes = new TextEncoder().encode('typeduck connectivity test ' + new Date().toISOString())
    const url = await ossUpload(cfg.value, bytes, 'text/plain', ossObjectName(cfg.value, 'txt').replace(/\.\w+$/, '') + '.txt')
    testState.value = 'ok'
    testMsg.value = `✓ 上传成功：${url.slice(0, 80)}${url.length > 80 ? '…' : ''}`
  } catch (err) {
    testState.value = 'fail'
    testMsg.value = err instanceof Error ? err.message : String(err)
  } finally {
    testing.value = false
  }
}

onMounted(() => { if (!cfg.value.endpoint) cfg.value.endpoint = '' })
</script>

<template>
  <teleport to="body">
    <div v-if="props.open" class="oss-overlay" @click.self="emit('close')">
      <div class="oss-dialog">
        <header class="dlg-head">
          <span class="dlg-title">🖼 图床设置（可选 · S3 兼容）</span>
          <button class="dlg-close" @click="emit('close')">✕</button>
        </header>
        <div class="dlg-body">
          <p class="intro">
            配置自己的图床后，插入的图片会上传到你自己的存储（博客等多平台复用）；
            <b>发草稿箱时自动转传公众号素材库</b>，正文图片直接显示。
            不配置也能用：图片暂存本地，发布时直传素材库。密钥只存本机。
          </p>

          <label>服务商</label>
          <div class="provider-row">
            <button
              v-for="p in OSS_PRESETS"
              :key="p.id"
              class="provider-btn"
              :class="{ active: cfg.provider === p.id }"
              @click="switchProvider(p.id)"
            >{{ p.name }}</button>
          </div>
          <p class="hint">{{ OSS_PRESETS.find(p => p.id === cfg.provider)?.endpointHint }}</p>

          <label>Endpoint（S3 兼容端点）</label>
          <input v-model="cfg.endpoint" placeholder="https://<账户ID>.r2.cloudflarestorage.com" spellcheck="false" />

          <div class="row-2">
            <div>
              <label>Bucket</label>
              <input v-model="cfg.bucket" placeholder="存储桶名" spellcheck="false" />
            </div>
            <div>
              <label>Region</label>
              <input v-model="cfg.region" placeholder="auto" spellcheck="false" />
            </div>
          </div>

          <label>AccessKeyId</label>
          <input v-model="cfg.accessKeyId" spellcheck="false" />

          <label>AccessKeySecret</label>
          <div class="secret-row">
            <input v-model="cfg.secretAccessKey" :type="showSecret ? 'text' : 'password'" spellcheck="false" />
            <button class="eye" @click="showSecret = !showSecret">{{ showSecret ? '🙈' : '👁' }}</button>
          </div>

          <label>公开访问域名（可选，CDN/自定义域）</label>
          <input v-model="cfg.publicBaseUrl" placeholder="https://img.example.com（留空用 Endpoint 地址）" spellcheck="false" />

          <label>目录前缀（可选）</label>
          <input v-model="cfg.prefix" placeholder="articles/" spellcheck="false" />

          <div class="ops">
            <button class="test" :disabled="testing || !configured" @click="test">
              {{ testing ? '测试中…' : '保存并测试连接' }}
            </button>
            <button v-if="configured" class="clear" @click="cfg = { provider: 'r2', endpoint: '', bucket: '', region: 'auto', accessKeyId: '', secretAccessKey: '', publicBaseUrl: '', prefix: '' }; save()">清空配置</button>
            <button class="done" @click="save(); emit('close')">完成</button>
          </div>
          <p v-if="testMsg" class="test-msg" :data-state="testState">{{ testMsg }}</p>
          <p class="note">⚠ Bucket 需开启公开读 + CORS 允许来自本应用的 PUT（详情见各云厂商文档）。</p>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.oss-overlay { position: fixed; inset: 0; z-index: 220; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; padding: 20px; }
.oss-dialog { width: 500px; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; background: #fff; border-radius: 12px; box-shadow: 0 16px 48px rgba(0,0,0,.22); overflow: hidden; }
.dlg-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid #e5e6eb; }
.dlg-title { font-size: 15px; font-weight: 700; }
.dlg-close { border: none; background: transparent; color: #999; cursor: pointer; font-size: 14px; padding: 4px 8px; border-radius: 6px; }
.dlg-close:hover { background: #f2f3f5; color: #333; }
.dlg-body { padding: 16px 18px; overflow-y: auto; }
.intro { font-size: 12.5px; color: #86909c; line-height: 1.7; margin: 0 0 14px; padding: 10px 12px; background: #f7f9f8; border-radius: 8px; }
.intro b { color: #07c160; }
label { display: block; font-size: 12.5px; font-weight: 600; color: #4e5969; margin: 12px 0 6px; }
input { width: 100%; height: 34px; border: 1px solid #e5e6eb; border-radius: 7px; padding: 0 10px; font-size: 13px; outline: none; font-family: Menlo, Consolas, monospace; box-sizing: border-box; }
input:focus { border-color: #07c160; }
.provider-row { display: flex; gap: 8px; flex-wrap: wrap; }
.provider-btn { flex: 1; min-width: 100px; height: 32px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.provider-btn.active { border-color: #07c160; color: #07c160; background: #f0faf4; }
.hint { font-size: 11.5px; color: #a8adb5; margin: 6px 0 0; }
.row-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 10px; }
.secret-row { display: flex; gap: 6px; }
.eye { width: 40px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; cursor: pointer; }
.ops { display: flex; gap: 8px; margin-top: 16px; }
.test { height: 32px; padding: 0 16px; border: none; border-radius: 7px; background: #07c160; color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.test:disabled { opacity: .5; cursor: default; }
.clear { height: 32px; padding: 0 12px; border: 1px solid #e5e6eb; border-radius: 7px; background: #fff; color: #4e5969; font-size: 12.5px; cursor: pointer; }
.done { margin-left: auto; height: 32px; padding: 0 20px; border: none; border-radius: 7px; background: #333; color: #fff; font-size: 12.5px; font-weight: 600; cursor: pointer; }
.test-msg { font-size: 12px; line-height: 1.6; margin: 10px 0 0; word-break: break-all; }
.test-msg[data-state='ok'] { color: #07c160; }
.test-msg[data-state='fail'] { color: #e5554e; }
.note { font-size: 11.5px; color: #c0c4cc; margin: 12px 0 0; }
</style>
