<script setup lang="ts">
import { computed, ref } from 'vue'
import { AI_PRESETS, OSS_PRESETS, testConnection as testAiConnection } from '@typeduck/core'
import { useAiStore } from '../stores/ai'
import { useEditorStore } from '../stores/editor'
import { clearAll as clearAllDb, getAllHistory, importDocs } from '../db'
import type { Doc, DocHistory } from '../db'
import ConfirmDialog from './ConfirmDialog.vue'

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

/** 默认视图的可视化选项：bars 为迷你示意图的栏数，gutter 指示哪一栏是窄边栏 */
const viewOptions = [
  { mode: 'all', label: '三栏', desc: '参考文、编辑与预览同时显示', bars: 3, gutter: 0 },
  { mode: 'refedit', label: '浏览+编辑', desc: '参考文与编辑并排', bars: 2, gutter: 0 },
  { mode: 'refprev', label: '浏览+预览', desc: '参考文与预览并排', bars: 2, gutter: 1 },
  { mode: 'split', label: '编辑+预览', desc: '编辑与预览并排显示', bars: 2, gutter: 0 },
  { mode: 'editor', label: '仅编辑', desc: '专注写作，隐藏预览', bars: 1, gutter: 0 },
  { mode: 'preview', label: '仅预览', desc: '发布前的阅读终检', bars: 2, gutter: 1 },
] as const

const selectedAiPreset = computed(() => AI_PRESETS.find((preset) => preset.id === ai.config.providerId) ?? AI_PRESETS[0])
const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)
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
  { id: 'ai', label: 'AI 配置服务', note: '模型、接口与密钥' },
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
  confirmAction.value = null
  showAction(true, '已清除所有敏感凭据，可到各配置页重新填写')
}

/** 用表单当前填写的 Base URL / API Key / 模型 发起一次真实请求，验证能否连通 */
async function testConnection() {
  const { baseUrl, apiKey, model } = ai.config
  if (!baseUrl || !apiKey || !model) {
    testResult.value = { ok: false, message: '请先填写 Base URL、API Key 和模型' }
    return
  }
  testing.value = true
  testResult.value = null
  try {
    const ms = await testAiConnection({ ...ai.config })
    testResult.value = { ok: true, message: `连接成功（${ms}ms）` }
  } catch (err) {
    testResult.value = { ok: false, message: err instanceof Error ? err.message : '连接失败' }
  } finally {
    testing.value = false
  }
}

/* ---------- 数据与隐私：存储位置、备份迁移与清除（均需二级确认） ---------- */

const editor = useEditorStore()
const isDesktop = !!window.desktopAPI
/** 正在等待确认的危险操作：null 无 / secrets 清除密钥 / docs 清除文档 / import 覆盖导入 */
const confirmAction = ref<'secrets' | 'docs' | 'import' | null>(null)
const pendingImport = ref<{ docs: Doc[]; history: DocHistory[] } | null>(null)
const actionMsg = ref<{ ok: boolean; text: string } | null>(null)
const importInput = ref<HTMLInputElement>()
let actionTimer: ReturnType<typeof setTimeout> | undefined

function showAction(ok: boolean, text: string) {
  actionMsg.value = { ok, text }
  clearTimeout(actionTimer)
  actionTimer = setTimeout(() => (actionMsg.value = null), 5000)
}

/** 校验并补齐备份文件里的文档字段（老备份可能缺字段，恢复时兜底） */
function toDoc(raw: unknown): Doc | null {
  const d = raw as Partial<Doc> | null
  if (!d || typeof d.id !== 'string' || typeof d.title !== 'string' || typeof d.content !== 'string') return null
  const now = Date.now()
  return {
    id: d.id,
    title: d.title,
    content: d.content,
    themeId: typeof d.themeId === 'string' ? d.themeId : 'minimal-white',
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : now,
    tags: Array.isArray(d.tags) ? d.tags.filter((t): t is string => typeof t === 'string') : [],
    status: d.status === 'published' || d.status === 'writing' ? d.status : 'draft',
    wordCount: typeof d.wordCount === 'number' ? d.wordCount : 0,
    estimatedReadTime: typeof d.estimatedReadTime === 'number' ? d.estimatedReadTime : 1,
  }
}

function toHistory(raw: unknown): DocHistory | null {
  const h = raw as Partial<DocHistory> | null
  if (!h || typeof h.id !== 'string' || typeof h.docId !== 'string' || typeof h.content !== 'string') return null
  return {
    id: h.id,
    docId: h.docId,
    title: typeof h.title === 'string' ? h.title : '',
    content: h.content,
    savedAt: typeof h.savedAt === 'number' ? h.savedAt : Date.now(),
  }
}

/** 导出全部数据备份（文档 + 历史版本）：桌面版保存对话框，浏览器版下载 JSON */
async function exportBackup() {
  try {
    const history = await getAllHistory()
    const payload = JSON.stringify(
      { app: 'typeduck', version: 1, exportedAt: Date.now(), docs: editor.docs, history },
      null,
      2,
    )
    const stamp = new Date().toISOString().slice(0, 10)
    if (isDesktop) {
      const res = await window.desktopAPI!.saveFileDialog(payload, `TypeDuck-备份-${stamp}.json`)
      if (res) showAction(true, `备份已保存到：${res.filePath}`)
    } else {
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `TypeDuck-备份-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      showAction(true, '备份文件已开始下载')
    }
  } catch {
    showAction(false, '导出备份失败，请重试')
  }
}

/** 桌面版：选择存储文件夹并把当前全部文档镜像进去（此后保存自动同步） */
async function chooseDataDir() {
  if (!window.desktopAPI) return
  try {
    const dir = await window.desktopAPI.selectDataDir()
    if (!dir) return
    await window.desktopAPI.writeDataDir(
      dir,
      editor.docs.map((d) => ({ id: d.id, title: d.title, content: d.content })),
    )
    editor.dataDir = dir
    showAction(true, `文档已镜像到：${dir}`)
  } catch (err) {
    showAction(false, err instanceof Error ? `设置失败：${err.message}` : '设置存储位置失败')
  }
}

/** 恢复默认存储（本机 IndexedDB）；文件夹内容保留，只是不再同步 */
function resetDataDir() {
  editor.dataDir = ''
  showAction(true, '已恢复默认存储（本机 IndexedDB），文件夹中的文件保留')
}

function onImportPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as { docs?: unknown[]; history?: unknown[] }
      const docs = (parsed.docs ?? []).map(toDoc).filter((d): d is Doc => d !== null)
      const history = (parsed.history ?? []).map(toHistory).filter((h): h is DocHistory => h !== null)
      if (!docs.length) throw new Error('备份文件中没有可用的文档')
      pendingImport.value = { docs, history }
      confirmAction.value = 'import'
    } catch (err) {
      showAction(false, err instanceof Error ? `无法读取备份：${err.message}` : '无法读取备份文件')
    }
  }
  reader.readAsText(file, 'utf-8')
}

/** 确认后用备份覆盖现有数据并重载，让编辑器读取恢复后的文档 */
async function doImport() {
  if (!pendingImport.value) return
  await importDocs(pendingImport.value.docs, pendingImport.value.history)
  confirmAction.value = null
  pendingImport.value = null
  location.reload()
}

/** 确认后清除全部本地文档与历史版本（IndexedDB 与桌面版存储文件夹），重载后回到全新欢迎文档 */
async function clearAllDocs() {
  await clearAllDb()
  if (isDesktop && editor.dataDir) {
    try {
      await window.desktopAPI!.clearDataDir(editor.dataDir)
    } catch {
      /* 文件夹清理失败不阻断清除 */
    }
  }
  confirmAction.value = null
  location.reload()
}

/** 二级确认弹窗：按当前待确认操作渲染标题、消息与按钮 */
const confirmDialog = computed(() => {
  const pending = pendingImport.value
  if (confirmAction.value === 'secrets') {
    return {
      title: '清除敏感凭据',
      message: '将清除 AI 配置、公众号、图库、热点和图床的全部密钥，之后需要重新填写。此操作不会删除任何文档。',
      confirmText: '清除密钥',
    }
  }
  if (confirmAction.value === 'docs') {
    return {
      title: '清除全部本地文档',
      message: `将永久删除 IndexedDB 中的全部文档与历史版本${isDesktop && editor.dataDir ? '，以及存储文件夹中的 .md 文件' : ''}。删除后无法恢复，建议先导出备份。`,
      confirmText: '清除文档',
    }
  }
  if (confirmAction.value === 'import' && pending) {
    return {
      title: '从备份恢复',
      message: `将用备份覆盖当前 ${pending.docs.length} 篇文档${pending.history.length ? `与 ${pending.history.length} 条历史版本` : ''}，现有数据会被替换。建议先导出当前数据的备份。`,
      confirmText: '恢复备份',
    }
  }
  return null
})

function onConfirm() {
  if (confirmAction.value === 'secrets') clearSecrets()
  else if (confirmAction.value === 'docs') void clearAllDocs()
  else if (confirmAction.value === 'import') void doImport()
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
              <button :class="{ ok: ai.isConfigured }" @click="section = 'ai'"><span>AI 配置服务</span><strong>{{ ai.isConfigured ? '已连接' : '待配置' }}</strong><small>{{ ai.config.model || '用于写作和摘要' }}</small></button>
              <button :class="{ ok: publishConfigured }" @click="section = 'publish'"><span>公众号发布</span><strong>{{ publishConfigured ? '已连接' : '待配置' }}</strong><small>草稿箱直发</small></button>
              <button :class="{ ok: imageConfigured || ossConfigured }" @click="section = 'media'"><span>图片服务</span><strong>{{ imageConfigured || ossConfigured ? '已连接' : '待配置' }}</strong><small>图库与图床</small></button>
              <button :class="{ ok: !!hotKey }" @click="section = 'hot'"><span>热点服务</span><strong>{{ hotKey ? '已连接' : '待配置' }}</strong><small>选题聚合</small></button>
            </div>
            <div class="info-band"><strong>本地优先</strong><span>文档保存在 IndexedDB，服务凭据保存在浏览器本地存储。桌面版后续可迁移到系统密钥链。</span></div>
          </template>

          <template v-else-if="section === 'ai'">
            <div class="field-grid"><label><span>服务商</span><select :value="ai.config.providerId" @change="ai.applyPreset(($event.target as HTMLSelectElement).value)"><option v-for="p in AI_PRESETS" :key="p.id" :value="p.id">{{ p.name }}</option></select></label><label><span>模型</span><input v-model="ai.config.model" placeholder="模型名称" /></label><label class="full"><span>Base URL</span><input v-model="ai.config.baseUrl" placeholder="https://api.example.com/v1" /></label><label class="full"><span>API Key</span><input v-model="ai.config.apiKey" :type="showSecrets ? 'text' : 'password'" placeholder="sk-..." /></label></div>
            <div class="test-row"><button class="test-btn" :disabled="testing" @click="testConnection">{{ testing ? '测试中…' : '测试连接' }}</button><span v-if="testResult" :class="['test-msg', testResult.ok ? 'ok' : 'fail']">{{ testResult.message }}</span></div>
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
            <div class="pref-card">
              <div class="pref-head"><strong>视图布局</strong><span>启动后的默认形态，可随时在工具栏切换</span></div>
              <div class="view-cards">
                <button v-for="v in viewOptions" :key="v.mode" :class="{ active: preferences.defaultView === v.mode }" @click="preferences.defaultView = v.mode">
                  <span class="mini" :class="v.mode"><i v-for="n in v.bars" :key="n" :class="n === v.gutter ? 'gutter' : ''"></i></span>
                  <strong>{{ v.label }}</strong><small>{{ v.desc }}</small>
                </button>
              </div>
              <label class="switch"><input v-model="preferences.syncScroll" type="checkbox" /><span class="sw-text"><strong>编辑与预览同步滚动</strong><em>在双栏视图中，滚动编辑区时预览跟随定位</em></span></label>
            </div>
            <div class="pref-card">
              <div class="pref-head"><strong>文档列表</strong><span>左侧文档栏的显示密度</span></div>
              <label class="switch"><input v-model="preferences.compactSidebar" type="checkbox" /><span class="sw-text"><strong>使用紧凑文档列表</strong><em>缩小卡片间距与缩略信息，一屏显示更多文档</em></span></label>
            </div>
          </template>

          <template v-else-if="section === 'privacy'">
            <div v-if="isDesktop" class="pref-card">
              <div class="pref-head"><strong>文档存储位置</strong><span>桌面版专属 · 把文档镜像到本地文件夹</span></div>
              <div class="store-row">
                <div class="store-info"><strong>{{ editor.dataDir ? '已设置文件夹存储' : '默认 · 本机 IndexedDB' }}</strong><span v-if="editor.dataDir">{{ editor.dataDir }}</span><span v-else>文档保存在应用数据目录，位置由系统管理</span></div>
                <div class="side-actions">
                  <button class="mini-btn" @click="chooseDataDir">{{ editor.dataDir ? '更改位置…' : '选择存储位置…' }}</button>
                  <button v-if="editor.dataDir" class="ghost-btn" @click="resetDataDir">恢复默认</button>
                </div>
              </div>
              <p class="migrate-hint">选择文件夹后，全部文档会立即以 Markdown 写入该文件夹，之后每次保存都自动同步；启动时优先从该文件夹加载。</p>
            </div>
            <div class="pref-card">
              <div class="pref-head"><strong>数据存储位置</strong><span>所有数据只保存在你的设备上，不经任何服务器</span></div>
              <div class="store-row">
                <div class="store-info"><strong>文档与历史版本</strong><span>IndexedDB「typeduck」 · 浏览器本地 · 每篇文档保留 30 版历史</span></div>
                <div class="store-side"><span class="store-count">{{ editor.docs.length }} 篇</span></div>
              </div>
              <div class="store-row">
                <div class="store-info"><strong>设置与凭据</strong><span>localStorage · 浏览器本地 · AI、公众号、图库、热点配置与编辑偏好</span></div>
              </div>
            </div>
            <div class="pref-card">
              <div class="pref-head"><strong>备份与迁移</strong><span>导出备份后可在任意设备恢复</span></div>
              <div class="store-row">
                <div class="store-info"><strong>数据备份</strong><span>把全部文档与历史版本打包为单个 JSON 文件</span></div>
                <div class="side-actions">
                  <button class="mini-btn" @click="exportBackup">导出全部数据备份</button>
                  <button class="mini-btn" @click="importInput?.click()">从备份导入…</button>
                  <input ref="importInput" type="file" accept=".json,application/json" class="hidden-input" @change="onImportPick" />
                </div>
              </div>
            </div>
            <div class="privacy-card">
              <div><strong>敏感凭据</strong><span>清除 AI、公众号、图库、热点和图床密钥，不会删除文档。</span></div>
              <button class="warn-btn" @click="confirmAction = 'secrets'">清除所有密钥</button>
            </div>
            <div class="danger-card">
              <div><strong>清除全部本地文档</strong><span>删除 IndexedDB{{ isDesktop && editor.dataDir ? '与存储文件夹' : '' }}中所有文档与历史版本，永久不可恢复。</span></div>
              <button class="warn-btn" @click="confirmAction = 'docs'">清除文档</button>
            </div>
            <div v-if="actionMsg" :class="['action-msg', actionMsg.ok ? 'ok' : 'fail']">{{ actionMsg.text }}</div>
          </template>
          <ConfirmDialog
            v-if="confirmDialog"
            :open="true"
            :title="confirmDialog.title"
            :message="confirmDialog.message"
            :confirm-text="confirmDialog.confirmText"
            danger
            @confirm="onConfirm"
            @cancel="confirmAction = null; pendingImport = null"
          />
        </div>
        <footer class="settings-foot"><label><input v-model="showSecrets" type="checkbox" />显示敏感字段</label><div><button class="secondary" @click="emit('close')">取消</button><button class="primary" @click="save">保存设置</button></div></footer>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-overlay{position:fixed;inset:0;z-index:240;display:grid;place-items:center;padding:24px;background:rgba(21,30,26,.44);backdrop-filter:blur(3px)}.settings-dialog{width:min(900px,100%);height:min(680px,calc(100vh - 48px));display:grid;grid-template-columns:220px minmax(0,1fr);grid-template-rows:minmax(0,1fr);overflow:hidden;border:1px solid #dce4df;border-radius:12px;background:#fff;box-shadow:0 24px 70px rgba(15,28,21,.24)}.settings-nav{padding:18px 12px;border-right:1px solid #e5eae7;background:#f8faf9}.settings-brand{display:grid;padding:0 10px 16px}.settings-brand strong{font-size:16px}.settings-brand span,.settings-nav p{color:#98a29d;font-size:11px}.settings-nav button{width:100%;display:grid;gap:0;margin:2px 0;padding:8px 11px;border:0;border-radius:7px;background:transparent;color:#68746e;text-align:left;cursor:pointer}.settings-nav button span{font-size:10px;color:#9ba49f}.settings-nav button.active{background:#e7f7ee;color:#087c45}.settings-nav p{margin:18px 10px 0;padding-top:14px;border-top:1px solid #e5eae7}.settings-main{min-width:0;min-height:0;height:100%;display:flex;flex-direction:column}.settings-head{flex:0 0 65px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;border-bottom:1px solid #e5eae7}.settings-head h2{margin:0;font-size:16px}.settings-head p{margin:1px 0 0;color:#929c97;font-size:11px}.close{width:30px;height:30px;border:0;border-radius:6px;background:#f3f5f4;color:#7d8882;font-size:18px;cursor:pointer}.settings-content{flex:1;min-height:0;overflow:auto;padding:12px 26px}.summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.summary-grid button{display:grid;gap:2px;padding:15px;border:1px solid #e5eae7;border-radius:8px;background:#fff;text-align:left;cursor:pointer}.summary-grid button.ok{border-color:#b8dfc7;background:#f7fcf9}.summary-grid span,.summary-grid small{color:#929c97;font-size:11px}.summary-grid strong{font-size:14px}.summary-grid .ok strong{color:#087c45}.info-band{display:grid;gap:4px;margin-top:18px;padding:15px;border-radius:8px;background:#f5f7f6}.info-band span,.hint{color:#838e88;font-size:12px}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field-grid label{display:grid;gap:5px}.field-grid label.full{grid-column:1/-1}.field-grid label span{font-size:12px;font-weight:650;color:#56635d}.field-grid input,.field-grid select{width:100%;height:36px;border:1px solid #dfe5e1;border-radius:7px;padding:0 10px;background:#fff;color:#1d2522;outline:0}.field-grid input:focus,.field-grid select:focus{border-color:#69b68a;box-shadow:0 0 0 3px #e7f7ee}.advanced-card,.privacy-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;padding:15px;border:1px solid #e5eae7;border-radius:10px;background:#fff}.test-row{display:flex;align-items:center;gap:10px;margin-top:12px}.test-btn{height:32px;padding:0 14px;border:1px solid #b8dfc7;border-radius:7px;background:#f4fbf7;color:#087c45;font-size:12px;font-weight:650;cursor:pointer}.test-btn:disabled{opacity:.55;cursor:wait}.test-msg{font-size:12px}.test-msg.ok{color:#087c45}.test-msg.fail{color:#c44d43}.store-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #e5eae7;border-radius:8px;background:#fff}.store-row+.store-row{margin-top:8px}.store-info{display:grid;gap:2px;min-width:0;overflow-wrap:anywhere}.store-info strong{font-size:12.5px;font-weight:650;color:#35413b}.store-info span{font-size:11px;color:#8b9690;line-height:1.5}.store-side{display:flex;align-items:center;gap:8px;flex-shrink:0}.store-count{font-size:10.5px;font-weight:650;color:#087c45;padding:2px 8px;border-radius:999px;background:#e7f7ee}.side-actions{display:grid;gap:8px;justify-items:end;flex-shrink:0}.mini-btn{height:28px;padding:0 12px;border:1px solid #b8dfc7;border-radius:6px;background:#f4fbf7;color:#087c45;font-size:11.5px;font-weight:650;cursor:pointer;white-space:nowrap}.mini-btn:hover{background:#e7f7ee}.migrate-hint{margin:10px 0 0;color:#8b9690;font-size:11px;line-height:1.6}.hidden-input{display:none}.danger-card{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;padding:15px;border:1px solid #f0c9c5;border-radius:10px;background:#fffaf9}.danger-card>div:first-child{display:flex;flex-direction:column;gap:2px}.danger-card strong{font-size:12.5px;font-weight:650;color:#35413b}.danger-card span{color:#8b9690;font-size:11px}.ghost-btn{height:30px;padding:0 12px;border:1px solid #dfe5e1;border-radius:6px;background:#fff;color:#66716b;cursor:pointer}.action-msg{margin-top:14px;padding:10px 14px;border-radius:8px;font-size:12px;line-height:1.5;word-break:break-all}.action-msg.ok{background:#e7f7ee;color:#087c45}.action-msg.fail{background:#fff7f6;color:#c44d43}.advanced-card div{display:flex;flex-direction:column}.advanced-card span,.privacy-card span{color:#8b9690;font-size:11px}.privacy-card>div:first-child{display:grid;gap:2px;min-width:0}.advanced-card button{height:30px;border:1px solid #b8dfc7;border-radius:6px;background:#f4fbf7;color:#087c45;cursor:pointer}.warn-btn{height:30px;padding:0 12px;border:1px solid #efc6c2;border-radius:6px;background:#fff7f6;color:#c44d43;cursor:pointer}.switch{display:flex;align-items:flex-start;gap:10px;margin-top:14px;padding-top:14px;border-top:1px dashed #e5eae7;color:#56635d;cursor:pointer}.switch input{margin-top:3px;accent-color:#08a95b}.sw-text{display:grid;gap:2px}.sw-text strong{font-size:12.5px;font-weight:650;color:#35413b}.sw-text em{font-style:normal;font-size:11px;color:#929c97;line-height:1.5}.pref-card{margin-bottom:10px;padding:14px;border:1px solid #e5eae7;border-radius:10px;background:#fcfdfc}.pref-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:12px}.pref-head strong{font-size:13px;color:#35413b}.pref-head span{font-size:11px;color:#929c97}.view-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.view-cards button{display:grid;gap:5px;padding:12px;border:1px solid #e5eae7;border-radius:9px;background:#fff;text-align:left;cursor:pointer}.view-cards button:hover{border-color:#c3d6cb}.view-cards button.active{border-color:#69b68a;box-shadow:0 0 0 3px #e7f7ee}.view-cards button strong{font-size:12.5px;font-weight:650;color:#35413b}.view-cards button small{font-size:11px;color:#929c97;line-height:1.5}.mini{display:flex;gap:3px;height:36px;padding:4px;border:1px solid #dfe5e1;border-radius:6px;background:#f5f7f6}.mini i{display:block;flex:1;min-width:0;border-radius:3px;background:#d3ddd7}.mini i.gutter{flex:0 0 34%}.view-cards button.active .mini{border-color:#69b68a;background:#eef8f2}.view-cards button.active .mini i{background:#9fd4b4}.settings-foot{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:14px 26px 26px;border-top:1px solid #e5eae7}.settings-foot>label{display:flex;gap:7px;color:#7c8781;font-size:11px}.settings-foot div{display:flex;gap:8px}.settings-foot button{height:32px;padding:0 15px;border-radius:7px;font-weight:650;cursor:pointer}.settings-foot .secondary{border:1px solid #dfe5e1;background:#fff;color:#66716b}.settings-foot .primary{border:1px solid #08a95b;background:#08a95b;color:#fff}@media(max-width:720px){.settings-overlay{padding:0}.settings-dialog{width:100%;height:100%;border:0;border-radius:0;grid-template-columns:1fr}.settings-nav{display:none}.settings-content{padding:18px 16px}.field-grid,.summary-grid,.view-cards{grid-template-columns:1fr}.field-grid label.full{grid-column:auto}.settings-head,.settings-foot{padding-left:16px;padding-right:16px}}
.help-card{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-top:16px;padding:13px 14px;border:1px solid #dfe8e3;border-radius:8px;background:#f7faf8}.help-card>div{display:grid;gap:2px;min-width:0}.help-card strong{color:#35413b;font-size:12px}.help-card span{color:#7e8983;font-size:11px;line-height:1.6}.help-card a,.advanced-actions a{flex-shrink:0;color:#087c45;font-size:11px;font-weight:650;text-decoration:none}.help-card a:hover,.advanced-actions a:hover{text-decoration:underline}.help-muted{flex-shrink:0}.advanced-actions{display:flex;align-items:center;gap:10px}.advanced-actions button{padding:0 10px}@media(max-width:720px){.help-card,.advanced-card{align-items:flex-start;flex-direction:column}.advanced-actions{width:100%;justify-content:space-between}}
</style>
