/* eslint-disable @typescript-eslint/no-var-requires */
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, net } = require('electron')
const path = require('path')
const fs = require('fs')

const DEV_URL = 'http://localhost:5173'
const isDev = !app.isPackaged

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

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
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

  if (isDev) {
    // 开发模式连 Vite dev server：轮询等待就绪后再加载，避免先启 Electron 导致白屏
    await waitForServer(DEV_URL, 15000)
    await mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // 打包后 web 构建产物在 resources/web/dist（extraResources，asar 外）
    mainWindow.loadFile(path.join(process.resourcesPath, 'web', 'dist', 'index.html'))
  }

  // 外部链接用系统浏览器打开，不在应用内跳走
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

/** 原生菜单：动作通过 IPC 广播给渲染进程，由应用层决定行为 */
function buildMenu() {
  const send = (channel) => (_, focusedWindow) => focusedWindow?.webContents.send(channel)
  const isMac = process.platform === 'darwin'

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建文档', accelerator: 'CmdOrCtrl+N', click: send('menu:new') },
        { type: 'separator' },
        { label: '打开 Markdown 文件…', accelerator: 'CmdOrCtrl+O', click: send('menu:open') },
        { label: '保存到文件', accelerator: 'CmdOrCtrl+S', click: send('menu:save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: send('menu:save-as') },
        { type: 'separator' },
        isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '刷新' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于排版鸭',
          click: () =>
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: '排版鸭 TypeDuck',
              detail:
                '排版呀，交给我吧！🦆\n\n微信公众号 Markdown 排版工具\n本地优先 · 完全免费 · MIT 开源\nhttps://github.com/efarsoft/TypeDuck',
            }),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/* ---------- IPC：文件对话框与读写（主进程独占 Node 能力） ---------- */

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开 Markdown 文件',
    filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = await fs.promises.readFile(filePath, 'utf-8')
  return { filePath, content, title: path.basename(filePath, path.extname(filePath)) }
})

ipcMain.handle('file:save', async (_event, { filePath, content }) => {
  await fs.promises.writeFile(filePath, content, 'utf-8')
  return { filePath }
})

ipcMain.handle('file:save-as', async (_event, { content, defaultPath }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '另存为 Markdown 文件',
    defaultPath: defaultPath || '未命名文档.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled) return null
  await fs.promises.writeFile(result.filePath, content, 'utf-8')
  return { filePath: result.filePath }
})

/* 主进程代理抓取：绕渲染进程 CORS 限制（热点榜单等公开数据），仅放行 https GET */
ipcMain.handle('net:fetch-text', async (_event, url) => {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error('仅支持 https 地址')
  }
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
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
    throw new Error('仅支持 https 地址')
  }
  const init = { method: options.method || 'GET', headers: options.headers || {} }
  if (options.body != null) init.body = options.body
  const res = await net.fetch(url, init)
  return { status: res.status, text: await res.text() }
})

/* ---------- 生命周期 ---------- */

app.whenReady().then(() => {
  createWindow()
  buildMenu()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
