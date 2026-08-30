/* eslint-disable @typescript-eslint/no-var-requires */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, net, screen } = require('electron')
const path = require('path')
const fs = require('fs')

const DEV_URL = 'http://localhost:5173/editor.html'
const isDev = !app.isPackaged
const grantedFilePaths = new Set()

function isTrustedRendererUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (isDev) return url.origin === new URL(DEV_URL).origin
    const editorPath = path.join(process.resourcesPath, 'web', 'dist', 'editor.html')
    const loadedPath = path.normalize(decodeURIComponent(url.pathname).replace(/^\/(?:[A-Za-z]:)/, (m) => m.slice(1)))
    return url.protocol === 'file:' && loadedPath === path.normalize(editorPath)
  } catch {
    return false
  }
}

function isPublicHttpsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password) return false
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
    if (host === 'localhost' || host === '::1' || host.endsWith('.localhost') || host.endsWith('.local')) return false
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return false
    const match172 = host.match(/^172\.(\d+)\./)
    if (match172 && Number(match172[1]) >= 16 && Number(match172[1]) <= 31) return false
    if (/^(?:0|224|240)\./.test(host) || host === '100.100.100.200') return false
    return true
  } catch {
    return false
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const protocol = new URL(rawUrl).protocol
    return protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:'
  } catch {
    return false
  }
}

function assertTrustedSender(event) {
  if (!isTrustedRendererUrl(event.senderFrame.url)) throw new Error('拒绝来自非受信页面的桌面请求')
}

/** 轮询等待 dev server 就绪（超时后仍尝试加载一次，让错误可见） */
async function waitForServer(url, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      await net.fetch(url)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 300))
    }
  }
}

let mainWindow = null

/* ---------- 窗口状态记忆：关闭重开时还原大小、位置与最大化/全屏状态 ---------- */

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

/** 读取上次保存的窗口状态；尺寸过小或位置落在所有显示器之外时丢弃（只保留尺寸） */
function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(WINDOW_STATE_FILE, 'utf-8'))
    if (typeof s.width !== 'number' || typeof s.height !== 'number' || s.width < 800 || s.height < 600) return null
    const visible =
      typeof s.x === 'number' && typeof s.y === 'number'
        ? screen.getAllDisplays().some((d) => {
            const a = d.workArea
            return s.x < a.x + a.width && s.x + s.width > a.x && s.y < a.y + a.height && s.y + s.height > a.y
          })
        : true
    if (!visible) return { width: s.width, height: s.height }
    return { width: s.width, height: s.height, x: s.x, y: s.y, isMaximized: !!s.isMaximized }
  } catch {
    return null
  }
}

function saveWindowState(win) {
  try {
    // 最大化时保存"还原后"的普通尺寸，取消最大化时窗口回到原来的大小
    const isMaximized = win.isMaximized()
    const b = isMaximized ? win.getNormalBounds() : win.getBounds()
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify({ ...b, isMaximized }))
  } catch {
    /* 状态保存失败不影响使用 */
  }
}

async function createWindow() {
  const saved = loadWindowState()
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 820,
    x: saved?.x,
    y: saved?.y,
    minWidth: 960,
    minHeight: 640,
    title: '排版鸭 TypeDuck',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // 安全默认：渲染进程接触不到 Node API
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // 尺寸/位置/最大化变化时记忆，关闭时兜底保存一次
  const remember = () => saveWindowState(mainWindow)
  mainWindow.on('resize', remember)
  mainWindow.on('move', remember)
  mainWindow.on('maximize', remember)
  mainWindow.on('unmaximize', remember)
  mainWindow.on('close', remember)
  if (saved?.isMaximized) mainWindow.maximize()

  if (isDev) {
    // 开发模式连 Vite dev server：轮询等待就绪后再加载，避免先启 Electron 导致白屏
    await waitForServer(DEV_URL, 15000)
    await mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 打包后 web 构建产物在 resources/web/dist（extraResources，asar 外）；
    // index.html 是静态官网首页，编辑器入口在 editor.html
    mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'dist', 'editor.html'))
  }

  // 外部链接用系统浏览器打开，不在应用内跳走
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isTrustedRendererUrl(url)) return
    event.preventDefault()
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
  })
}

/* ---------- IPC：文件对话框与读写（主进程独占 Node 能力） ---------- */

ipcMain.handle('file:open', async (event) => {
  assertTrustedSender(event)
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  grantedFilePaths.add(path.resolve(filePath))
  const content = await fs.promises.readFile(filePath, 'utf-8')
  return { filePath, content, title: path.basename(filePath, path.extname(filePath)) }
})

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  assertTrustedSender(_event)
  if (typeof filePath !== 'string' || typeof content !== 'string') throw new Error('无效的保存参数')
  if (!/\.(?:md|markdown|txt)$/i.test(filePath)) throw new Error('仅允许保存 Markdown 或文本文件')
  if (!grantedFilePaths.has(path.resolve(filePath))) throw new Error('该路径未经用户授权')
  await fs.promises.writeFile(filePath, content, 'utf-8')
  return { filePath }
})

ipcMain.handle('file:save-as', async (_event, { content, defaultPath }) => {
  assertTrustedSender(_event)
  if (typeof content !== 'string') throw new Error('无效的保存内容')
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '另存为 Markdown 文件',
    defaultPath: defaultPath || '未命名文档.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled) return null
  grantedFilePaths.add(path.resolve(result.filePath))
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  return { filePath: result.filePath }
})

/* ---------- IPC：文档存储位置（数据目录）——桌面版把文档镜像到用户选择的文件夹 ----------
 * 目录经用户选择后加入授权集合；应用重启后由渲染进程重新授权（renderer 本身受信）。 */

const grantedDataDirs = new Set()

function assertGrantedDataDir(dir) {
  const resolved = path.resolve(dir)
  if (!grantedDataDirs.has(resolved)) throw new Error('该目录未经用户授权')
  return resolved
}

ipcMain.handle('data-dir:select', async (event) => {
  assertTrustedSender(event)
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择文档存储文件夹',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const dir = path.resolve(result.filePaths[0])
  grantedDataDirs.add(dir)
  return dir
})

/** 应用重启后授权丢失，渲染进程启动时用它重新授权已配置的目录（目录必须存在） */
ipcMain.handle('data-dir:authorize', async (event, dir) => {
  assertTrustedSender(event)
  if (typeof dir !== 'string' || !dir) throw new Error('无效的目录')
  const resolved = path.resolve(dir)
  const stat = await fs.promises.stat(resolved).catch(() => null)
  if (!stat || !stat.isDirectory()) throw new Error('目录不存在')
  grantedDataDirs.add(resolved)
  return resolved
})

/** 全量镜像：分配文件名（标题清洗 + 重名序号）、写 index.json 与各 .md、清理改名残留的旧文件 */
ipcMain.handle('data-dir:write', async (event, dir, docs) => {
  assertTrustedSender(event)
  const resolved = assertGrantedDataDir(dir)
  if (!Array.isArray(docs) || docs.length > 500) throw new Error('无效的文档数据')
  for (const d of docs) {
    if (typeof d?.id !== 'string' || typeof d?.title !== 'string' || typeof d?.content !== 'string') {
      throw new Error('无效的文档数据')
    }
  }
  const indexPath = path.join(resolved, 'index.json')
  let prevFiles = []
  try {
    const prev = JSON.parse(await fs.promises.readFile(indexPath, 'utf-8'))
    if (Array.isArray(prev.docs)) {
      prevFiles = prev.docs.map((m) => m.file).filter((f) => typeof f === 'string')
    }
  } catch {
    /* 无旧 index 视为首次写入 */
  }
  const used = new Set()
  const meta = []
  for (const d of docs) {
    const safe = (d.title || '未命名文档').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 60) || '未命名文档'
    let file = safe + '.md'
    let i = 2
    while (used.has(file)) file = `${safe} (${i++}).md`
    used.add(file)
    meta.push({ id: d.id, title: d.title, file, updatedAt: Date.now() })
    await fs.promises.writeFile(path.join(resolved, file), d.content, 'utf-8')
  }
  await fs.promises.writeFile(
    indexPath,
    JSON.stringify({ version: 1, updatedAt: Date.now(), docs: meta }, null, 2),
    'utf-8',
  )
  // 清理本次未写入的旧文件（标题改名/删除文档的残留）
  for (const f of prevFiles) {
    if (!used.has(f)) {
      try {
        await fs.promises.unlink(path.join(resolved, f))
      } catch {
        /* 文件已不存在则忽略 */
      }
    }
  }
  return { dir: resolved, count: docs.length }
})

/** 读取数据目录：index 元数据 + 各 .md 内容（渲染进程启动加载用） */
ipcMain.handle('data-dir:read', async (event, dir) => {
  assertTrustedSender(event)
  const resolved = assertGrantedDataDir(dir)
  const indexPath = path.join(resolved, 'index.json')
  let parsed
  try {
    parsed = JSON.parse(await fs.promises.readFile(indexPath, 'utf-8'))
  } catch {
    return { index: { docs: [] }, docs: [] }
  }
  const metas = Array.isArray(parsed.docs) ? parsed.docs : []
  const out = []
  for (const m of metas) {
    if (typeof m?.file !== 'string') continue
    try {
      const content = await fs.promises.readFile(path.join(resolved, m.file), 'utf-8')
      out.push({ file: m.file, content })
    } catch {
      /* 单个文件缺失跳过 */
    }
  }
  return { index: parsed, docs: out }
})

/** 清空数据目录中由应用管理的文件（index.json + 各 .md），清除本地文档时联动 */
ipcMain.handle('data-dir:clear', async (event, dir) => {
  assertTrustedSender(event)
  const resolved = assertGrantedDataDir(dir)
  const indexPath = path.join(resolved, 'index.json')
  let files = []
  try {
    const parsed = JSON.parse(await fs.promises.readFile(indexPath, 'utf-8'))
    if (Array.isArray(parsed.docs)) {
      files = parsed.docs.map((m) => m.file).filter((f) => typeof f === 'string')
    }
  } catch {
    /* 无 index 则只清 index 本身 */
  }
  files.push('index.json')
  for (const f of files) {
    try {
      await fs.promises.unlink(path.join(resolved, f))
    } catch {
      /* 文件已不存在则忽略 */
    }
  }
})

/* 主进程代理抓取：绕渲染进程 CORS 限制（热点榜单等公开数据），仅放行 https GET */
ipcMain.handle('net:fetch-text', async (_event, url) => {
  assertTrustedSender(_event)
  if (typeof url !== 'string' || !isPublicHttpsUrl(url)) throw new Error('仅支持公开的 https 地址')
  const res = await net.fetch(url, {
    headers: {
      // NewsNow 等站点有 Cloudflare UA 过滤，需要浏览器 UA
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
})

/* 主进程通用请求通道（https）：微信草稿箱等需要 POST 的接口用，
 * 微信接口有 IP 白名单机制，从本机出口正好是用户自己的 IP */
ipcMain.handle('net:request', async (_event, url, options = {}) => {
  assertTrustedSender(_event)
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error('仅支持 https 地址')
  }
  const target = new URL(url)
  if (target.hostname !== 'api.weixin.qq.com') throw new Error('通用请求通道仅允许微信 API')
  const method = String(options.method || 'GET').toUpperCase()
  if (!['GET', 'POST'].includes(method)) throw new Error('不支持的请求方法')
  const init = { method, headers: options.headers || {} }
  if (options.body != null) init.body = options.body
  const res = await net.fetch(url, init)
  return { status: res.status, text: await res.text() }
})

/* ---------- 生命周期 ---------- */

/* ---------- 注入到公众号编辑器（参考 moyuan 扩展的注入方式） ---------- */

const WECHAT_HOST = 'mp.weixin.qq.com'
let wechatWindow = null
let wechatPayload = { html: '', title: '' }

/**
 * 注入脚本（在公众号后台页面主世界执行）：
 * 按选择器定位编辑器（新版 ProseMirror → 旧版 ueditor 容器 → 任意可编辑区），
 * 直接设置 innerHTML 并派发 input/change 事件让编辑器感知；标题框一并回填。
 */
const INJECT_SCRIPT = `(async () => {
  const payload = await window.__tdInject?.getPayload?.()
  if (!payload || !payload.html) return { ok: false, msg: '注入数据为空' }
  const selectors = [
    '#ueditor_0 > div > div > div > div.ProseMirror',
    '#ueditor_0 .edui-body-container',
    '#ueditor_0',
    '[contenteditable="true"]',
  ]
  let editor = null
  for (const sel of selectors) {
    const el = document.querySelector(sel)
    if (el) { editor = el; break }
  }
  if (!editor) return { ok: false, msg: '未找到编辑器区域' }
  editor.innerHTML = payload.html
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  editor.dispatchEvent(new Event('change', { bubbles: true }))
  if (payload.title) {
    const titleInput = document.querySelector('#js_title') || document.querySelector('.title_editor input')
    if (titleInput && !titleInput.value) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(titleInput, payload.title)
      titleInput.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }
  return { ok: true, msg: '已注入到公众号编辑器' }
})()`

/** 尝试在微信窗口当前页面执行注入；不在编辑页时返回 needPage 提示 */
async function tryInjectIntoWechat() {
  if (!wechatWindow || wechatWindow.isDestroyed()) return { ok: false, msg: '公众号窗口未打开' }
  let host = ''
  try {
    host = new URL(wechatWindow.webContents.getURL()).hostname
  } catch { /* 页面未就绪 */ }
  if (host !== WECHAT_HOST) {
    return { ok: false, needPage: true, msg: '请在公众号后台的图文编辑页再次点击注入' }
  }
  try {
    const result = await wechatWindow.webContents.executeJavaScript(INJECT_SCRIPT)
    if (result && result.ok) return result
    return { ok: false, needPage: true, msg: (result && result.msg) || '未找到编辑器，请打开图文编辑页后再次点击注入' }
  } catch (err) {
    return { ok: false, msg: '注入执行失败：' + (err && err.message ? err.message : String(err)) }
  }
}

/** 编辑器 → 主进程：携带负载打开/聚焦公众号后台，并尝试注入 */
ipcMain.handle('wechat:inject', async (event, payload = {}) => {
  assertTrustedSender(event)
  wechatPayload = { html: String(payload.html || ''), title: String(payload.title || '') }
  if (!wechatPayload.html) return { ok: false, msg: '正文为空，无法注入' }

  if (!wechatWindow || wechatWindow.isDestroyed()) {
    wechatWindow = new BrowserWindow({
      width: 1280,
      height: 860,
      title: '公众号后台 - 排版鸭注入',
      webPreferences: {
        // 专用最小 preload（只暴露取负载），不挂载主 preload，避免暴露文件能力
        preload: path.join(__dirname, 'wechat-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false, // executeJavaScript 注入需要非 sandbox 环境
      },
    })
    wechatWindow.loadURL('https://' + WECHAT_HOST + '/')
    wechatWindow.on('closed', () => { wechatWindow = null })
    // 同域名（含图文编辑等 window.open 新开页）留在窗口内导航；
    // 异域名才交给系统浏览器，避免微信后台把编辑页开在外部浏览器导致注入失败
    wechatWindow.webContents.on('will-navigate', (event, url) => {
      try {
        if (new URL(url).hostname === WECHAT_HOST) return
      } catch { /* 非法地址按外部处理 */ }
      event.preventDefault()
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    })
    wechatWindow.webContents.setWindowOpenHandler(({ url }) => {
      try {
        if (new URL(url).hostname === WECHAT_HOST) {
          void wechatWindow.loadURL(url)
          return { action: 'deny' }
        }
      } catch { /* 非法地址按外部处理 */ }
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
  } else {
    wechatWindow.show()
    wechatWindow.focus()
  }
  return tryInjectIntoWechat()
})

/** 微信窗口 preload：返回当前待注入的负载 */
ipcMain.handle('wechat:get-payload', (event) => {
  if (event.sender !== (wechatWindow && wechatWindow.webContents)) return null
  return wechatPayload
})

app.whenReady().then(() => {
  createWindow()
  // 不再使用顶部菜单栏（Win/Linux 完全隐藏；macOS 系统菜单栏是系统强制保留的）
  Menu.setApplicationMenu(null)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
