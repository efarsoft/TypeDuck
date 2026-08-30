const { contextBridge, ipcRenderer } = require('electron')

/**
 * 安全桥：只暴露白名单内的文件能力。
 * 渲染进程拿不到 ipcRenderer 本体，只能调这三个方法。
 */
contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,

  /** 打开 .md 文件，返回 { filePath, content, title } 或 null（取消） */
  openFile: () => ipcRenderer.invoke('file:open'),

  /** 写入已知路径，返回 { filePath } */
  saveFile: (filePath, content) => ipcRenderer.invoke('file:save', { filePath, content }),

  /** 弹出另存为对话框，返回 { filePath } 或 null（取消） */
  saveFileDialog: (content, defaultPath) =>
    ipcRenderer.invoke('file:save-as', { content, defaultPath }),

  /** 选择文档存储文件夹（数据镜像），返回路径或 null（取消） */
  selectDataDir: () => ipcRenderer.invoke('data-dir:select'),

  /** 重新授权已配置的存储文件夹（应用重启后授权丢失） */
  authorizeDataDir: (dir) => ipcRenderer.invoke('data-dir:authorize', dir),

  /** 全量镜像文档到存储文件夹：写 index.json 与各 .md，返回 { dir, count } */
  writeDataDir: (dir, docs) => ipcRenderer.invoke('data-dir:write', dir, docs),

  /** 读取存储文件夹的 index 与全部 .md 内容 */
  readDataDir: (dir) => ipcRenderer.invoke('data-dir:read', dir),

  /** 清空存储文件夹内由应用管理的文件（index.json + 各 .md） */
  clearDataDir: (dir) => ipcRenderer.invoke('data-dir:clear', dir),

  /** 主进程代理抓取公开数据（仅 https GET，返回响应文本），绕渲染进程 CORS 限制 */
  fetchText: (url) => ipcRenderer.invoke('net:fetch-text', url),

  /** 主进程通用 https 请求（支持 POST/自定义头/请求体），微信草稿箱等接口用 */
  request: (url, options) => ipcRenderer.invoke('net:request', url, options),

  /** 注入当前文档到公众号编辑器：打开/聚焦微信后台并尝试注入，返回 { ok, needPage?, msg } */
  injectWechat: (html, title) => ipcRenderer.invoke('wechat:inject', { html, title }),

  /** 订阅原生菜单事件（menu:new / menu:open / menu:save / menu:save-as） */
  onMenu: (channel, callback) => {
    const allowed = ['menu:new', 'menu:open', 'menu:save', 'menu:save-as']
    if (!allowed.includes(channel)) return () => {}
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
