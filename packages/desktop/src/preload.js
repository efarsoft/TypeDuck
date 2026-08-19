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

  /** 订阅原生菜单事件（menu:new / menu:open / menu:save / menu:save-as） */
  onMenu: (channel, callback) => {
    const allowed = ['menu:new', 'menu:open', 'menu:save', 'menu:save-as']
    if (!allowed.includes(channel)) return () => {}
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
