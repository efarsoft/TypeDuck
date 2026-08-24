<script setup lang="ts">
import { computed, ref } from 'vue'
import { AI_PRESETS, OSS_PRESETS } from '@typeduck/core'
import { useAiStore } from '../stores/ai'

type Section = 'overview' | 'ai' | 'publish' | 'media' | 'hot' | 'appearance' | 'privacy'

const props = withDefaults(defineProps<{ initialSection?: Section }>(), { initialSection: 'overview' })
const emit = defineEmits<{ (e: 'close'): void; (e: 'open-oss'): void }>()
const ai = useAiStore()
const section = ref<Section>(props.initialSection)
const showSecrets = ref(false)

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

const wechat = ref(loadJson('typeduck:wechat', { appId: '', appSecret: '' }))
const image = ref(loadJson('typeduck:imageConfig', { provider: 'unsplash', key: '' }))
const hotKey = ref(localStorage.getItem('typeduck:hotKey') ?? '')
const preferences = ref(loadJson('typeduck:preferences', { defaultView: 'split', syncScroll: true, compactSidebar: false }))

const selectedAiPreset = computed(() => AI_PRESETS.find((preset) => preset.id === ai.config.providerId) ?? AI_PRESETS[0])
const imageGuide = computed(() =>
  image.value.provider === 'pexels'
    ? { name: 'Pexels API', url: 'https://www.pexels.com/api/', text: '注册 Pexels 后创建 API Key；图片搜索每小时有免费额度。' }
    : { name: 'Unsplash Developers', url: 'https://unsplash.com/developers', text: '创建一个应用并复制 Access Key；免费应用适合日常配图搜索。' },
)
const ossGuide = computed(() => OSS_PRESETS.find((preset) => preset.id === 'r2') ?? OSS_PRESETS[0])

const ossConfigured = computed(() => {
  const cfg = loadJson('typeduck:oss', { endpoint: '', bucket: '', accessKeyId: '', secretAccessKey: '' })
  return !!(cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey)
})
const publishConfigured = computed(() => !!(wechat.value.appId && wechat.value.appSecret))
const imageConfigured = computed(() => !!image.value.key)

const nav: { id: Section; label: string; note: string }[] = [
  { id: 'overview', label: '配置概览', note: '连接状态与快捷入口' },
  { id: 'ai', label: 'AI 服务', note: '模型、接口与密钥' },
  { id: 'publish', label: '公众号发布', note: 'AppID 与 AppSecret' },
  { id: 'media', label: '图片与图床', note: '图库和对象存储' },
  { id: 'hot', label: '热点服务', note: '选题聚合 API' },
  { id: 'appearance', label: '编辑与外观', note: '默认视图与编辑偏好' },
  { id: 'privacy', label: '数据与隐私', note: '本地数据与凭据' },
]

function save() {
  localStorage.setItem('typeduck:wechat', JSON.stringify(wechat.value))
  localStorage.setItem('typeduck:imageConfig', JSON.stringify(image.value))
  localStorage.setItem('typeduck:hotKey', hotKey.value.trim())
  localStorage.setItem('typeduck:preferences', JSON.stringify(preferences.value))
  // 通知 AppEditor 偏好已更新（同页 localStorage 不触发 storage 事件）
  window.dispatchEvent(new CustomEvent('typeduck:prefs-updated', { detail: preferences.value }))
  emit('close')
}

function clearSecrets() {
  ai.config.apiKey = ''
  wechat.value.appSecret = ''
  image.value.key = ''
  hotKey.value = ''
  localStorage.removeItem('typeduck:wechat')
  localStorage.removeItem('typeduck:imageConfig')
  localStorage.removeItem('typeduck:hotKey')
  localStorage.removeItem('typeduck:oss')
}
</script>

<template>
  <div class="settings-overlay" @click.self="emit('close')">
    <section class="settings-dialog">
      <nav class="settings-nav">
        <div class="settings-brand"><strong>设置中心</strong><span>TypeDuck 工作台</span></div>
        <button v-for="item in nav" :key="item.id" :class="{ active: section === item.id }" @click="section = item.id">
          <strong>{{ item.label }}</strong><span>{{ item.note }}</span>
        </button>
        <p>配置默认保存在当前设备。敏感凭据不会经过 TypeDuck 服务器。</p>
      </nav>

      <div class="settings-main">
        <header class="settings-head"><div><h2>{{ nav.find((item) => item.id === section)?.label }}</h2><p>{{ nav.find((item) => item.id === section)?.note }}</p></div><button class="close" title="关闭设置" @click="emit('close')">×</button></header>
        <div class="settings-content">
          <template v-if="section === 'overview'">
            <div class="summary-grid">
              <button :class="{ ok: ai.isConfigured }" @click="section = 'ai'"><span>AI 服务</span><strong>{{ ai.isConfigured ? '已连接' : '待配置' }}</strong><small>{{ ai.config.model || '用于写作和摘要' }}</small></button>
              <button :class="{ ok: publishConfigured }" @click="section = 'publish'"><span>公众号发布</span><strong>{{ publishConfigured ? '已连接' : '待配置' }}</strong><small>草稿箱直发</small></button>
              <button :class="{ ok: imageConfigured || ossConfigured }" @click="section = 'media'"><span>图片服务</span><strong>{{ imageConfigured || ossConfigured ? '已连接' : '待配置' }}</strong><small>图库与图床</small></button>
              <button :class="{ ok: !!hotKey }" @click="section = 'hot'"><span>热点服务</span><strong>{{ hotKey ? '已连接' : '待配置' }}</strong><small>选题聚合</small></button>
            </div>
            <div class="info-band"><strong>本地优先</strong><span>文档保存在 IndexedDB，服务凭据保存在浏览器本地存储。桌面版后续可迁移到系统密钥链。</span></div>
          </template>

          <template v-else-if="section === 'ai'">
            <div class="field-grid"><label><span>服务商</span><select :value="ai.config.providerId" @change="ai.applyPreset(($event.target as HTMLSelectElement).value)"><option v-for="p in AI_PRESETS" :key="p.id" :value="p.id">{{ p.name }}</option></select></label><label><span>模型</span><input v-model="ai.config.model" placeholder="模型名称" /></label><label class="full"><span>Base URL</span><input v-model="ai.config.baseUrl" placeholder="https://api.example.com/v1" /></label><label class="full"><span>API Key</span><input v-model="ai.config.apiKey" :type="showSecrets ? 'text' : 'password'" placeholder="sk-..." /></label></div>
            <div class="help-card"><div><strong>如何申请 {{ selectedAiPreset.name }} API Key？</strong><span>{{ selectedAiPreset.note || '打开官方控制台，创建 API Key，并确认账户已开通模型调用权限。' }}</span></div><a v-if="selectedAiPreset.keyUrl" :href="selectedAiPreset.keyUrl" target="_blank" rel="noopener">打开申请页面 ↗</a><span v-else class="help-muted">自定义服务商请查看服务商文档</span></div>
          </template>

          <template v-else-if="section === 'publish'">
            <div class="field-grid"><label><span>公众号 AppID</span><input v-model="wechat.appId" placeholder="wx1234567890abcdef" /></label><label><span>AppSecret</span><input v-model="wechat.appSecret" :type="showSecrets ? 'text' : 'password'" placeholder="开发者密码" /></label></div><div class="help-card"><div><strong>在哪里找到公众号配置？</strong><span>登录公众平台，进入“设置与开发 → 基本配置”。首次发布还需要把本机出口 IP 加入白名单。</span></div><a href="https://mp.weixin.qq.com/" target="_blank" rel="noopener">打开微信公众平台 ↗</a></div>
          </template>

          <template v-else-if="section === 'media'">
            <div class="field-grid"><label><span>图库服务</span><select v-model="image.provider"><option value="unsplash">Unsplash</option><option value="pexels">Pexels</option></select></label><label><span>图库 API Key</span><input v-model="image.key" :type="showSecrets ? 'text' : 'password'" placeholder="图库访问密钥" /></label></div><div class="help-card"><div><strong>如何申请 {{ imageGuide.name }} Key？</strong><span>{{ imageGuide.text }}</span></div><a :href="imageGuide.url" target="_blank" rel="noopener">查看申请说明 ↗</a></div><div class="advanced-card"><div><strong>S3 兼容图床</strong><span>{{ ossConfigured ? '已配置，可直接上传图片' : '可选：Cloudflare R2 / 阿里云 OSS / 腾讯云 COS' }}</span></div><div class="advanced-actions"><a :href="ossGuide.docs" target="_blank" rel="noopener">查看 {{ ossGuide.name }} 文档 ↗</a><button @click="emit('open-oss')">{{ ossConfigured ? '管理图床' : '配置图床' }}</button></div></div>
          </template>

          <template v-else-if="section === 'hot'">
            <div class="field-grid"><label class="full"><span>allnet.hot API Key</span><input v-model="hotKey" :type="showSecrets ? 'text' : 'password'" placeholder="热点聚合服务密钥" /></label></div><div class="help-card"><div><strong>热点服务需要单独申请 Key</strong><span>打开 allnet.hot 注册并创建开放 API Key；没有 Key 也可以继续使用编辑器和主题功能。</span></div><a href="https://allnet.hot/" target="_blank" rel="noopener">打开 allnet.hot ↗</a></div>
          </template>

          <template v-else-if="section === 'appearance'">
            <div class="field-grid"><label><span>默认视图</span><select v-model="preferences.defaultView"><option value="split">双栏</option><option value="editor">仅编辑</option><option value="preview">仅预览</option></select></label></div><label class="switch"><input v-model="preferences.syncScroll" type="checkbox" /><span>编辑与预览同步滚动</span></label><label class="switch"><input v-model="preferences.compactSidebar" type="checkbox" /><span>使用紧凑文档列表</span></label>
          </template>

          <template v-else>
            <div class="privacy-card"><strong>敏感凭据</strong><span>清除 AI、公众号、图库、热点和图床密钥，不会删除文档。</span><button @click="clearSecrets">清除所有密钥</button></div><div class="privacy-card"><strong>本地文档</strong><span>文档和历史版本保存在浏览器 IndexedDB 中。清理站点数据会永久删除它们。</span></div>
          </template>
        </div>
        <footer class="settings-foot"><label><input v-model="showSecrets" type="checkbox" />显示敏感字段</label><div><button class="secondary" @click="emit('close')">取消</button><button class="primary" @click="save">保存设置</button></div></footer>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-overlay{position:fixed;inset:0;z-index:240;display:grid;place-items:center;padding:24px;background:rgba(21,30,26,.44);backdrop-filter:blur(3px)}.settings-dialog{width:min(900px,100%);height:min(680px,calc(100vh - 48px));display:grid;grid-template-columns:220px minmax(0,1fr);overflow:hidden;border:1px solid #dce4df;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,28,21,.24)}.settings-nav{padding:18px 12px;border-right:1px solid #e5eae7;background:#f8faf9}.settings-brand{display:grid;padding:0 10px 16px}.settings-brand strong{font-size:16px}.settings-brand span,.settings-nav p{color:#98a29d;font-size:11px}.settings-nav button{width:100%;display:grid;gap:0;margin:2px 0;padding:8px 11px;border:0;border-radius:7px;background:transparent;color:#68746e;text-align:left;cursor:pointer}.settings-nav button span{font-size:10px;color:#9ba49f}.settings-nav button.active{background:#e7f7ee;color:#087c45}.settings-nav p{margin:18px 10px 0;padding-top:14px;border-top:1px solid #e5eae7}.settings-main{min-width:0;display:grid;grid-template-rows:65px 1fr 62px}.settings-head{display:flex;align-items:center;justify-content:space-between;padding:0 26px;border-bottom:1px solid #e5eae7}.settings-head h2{margin:0;font-size:16px}.settings-head p{margin:1px 0 0;color:#929c97;font-size:11px}.close{width:30px;height:30px;border:0;border-radius:6px;background:#f3f5f4;color:#7d8882;font-size:18px;cursor:pointer}.settings-content{overflow:auto;padding:24px 26px}.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.summary-grid button{display:grid;gap:2px;padding:15px;border:1px solid #e5eae7;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.summary-grid button.ok{border-color:#b8dfc7;background:#f7fcf9}.summary-grid span,.summary-grid small{color:#929c97;font-size:11px}.summary-grid strong{font-size:14px}.summary-grid .ok strong{color:#087c45}.info-band{display:grid;gap:4px;margin-top:18px;padding:15px;border-radius:8px;background:#f5f7f6}.info-band span,.hint{color:#838e88;font-size:12px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field-grid label{display:grid;gap:5px}.field-grid label.full{grid-column:1/-1}.field-grid label span{font-size:12px;font-weight:650;color:#56635d}.field-grid input,.field-grid select{width:100%;height:36px;border:1px solid #dfe5e1;border-radius:7px;padding:0 10px;background:#fff;color:#1d2522;outline:0}.field-grid input:focus,.field-grid select:focus{border-color:#69b68a;box-shadow:0 0 0 3px #e7f7ee}.advanced-card,.privacy-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:18px;padding:15px;border:1px solid #e5eae7;border-radius:8px}.advanced-card div,.privacy-card{display:flex;flex-direction:column}.advanced-card span,.privacy-card span{color:#8b9690;font-size:11px}.advanced-card button,.privacy-card button{height:30px;border:1px solid #b8dfc7;border-radius:6px;background:#f4fbf7;color:#087c45;cursor:pointer}.privacy-card button{align-self:flex-start;margin-top:10px;padding:0 12px;border-color:#efc6c2;background:#fff7f6;color:#c44d43}.switch{display:flex;align-items:center;gap:8px;margin-top:16px;color:#56635d}.settings-foot{display:flex;align-items:center;justify-content:space-between;padding:0 26px;border-top:1px solid #e5eae7}.settings-foot>label{display:flex;gap:7px;color:#7c8781;font-size:11px}.settings-foot div{display:flex;gap:8px}.settings-foot button{height:32px;padding:0 15px;border-radius:7px;font-weight:650;cursor:pointer}.settings-foot .secondary{border:1px solid #dfe5e1;background:#fff;color:#66716b}.settings-foot .primary{border:1px solid #08a95b;background:#08a95b;color:#fff}@media(max-width:720px){.settings-overlay{padding:0}.settings-dialog{width:100%;height:100%;border:0;border-radius:0;grid-template-columns:1fr}.settings-nav{display:none}.settings-content{padding:18px 16px}.field-grid,.summary-grid{grid-template-columns:1fr}.field-grid label.full{grid-column:auto}.settings-head,.settings-foot{padding-left:16px;padding-right:16px}}
.help-card{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:16px;padding:13px 14px;border:1px solid #dfe8e3;border-radius:8px;background:#f7faf8}.help-card>div{display:grid;gap:2px;min-width:0}.help-card strong{color:#35413b;font-size:12px}.help-card span{color:#7e8983;font-size:11px;line-height:1.6}.help-card a,.advanced-actions a{flex-shrink:0;color:#087c45;font-size:11px;font-weight:650;text-decoration:none}.help-card a:hover,.advanced-actions a:hover{text-decoration:underline}.help-muted{flex-shrink:0}.advanced-actions{display:flex;align-items:center;gap:10px}.advanced-actions button{padding:0 10px}@media(max-width:720px){.help-card,.advanced-card{align-items:flex-start;flex-direction:column}.advanced-actions{width:100%;justify-content:space-between}}
</style>
