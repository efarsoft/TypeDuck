const { contextBridge, ipcRenderer } = require('electron')

/**
 * 微信后台窗口专用桥：仅暴露「取注入负载」一个能力，
 * 供主进程注入的内容脚本读取当前文档 HTML/标题。
 * 不暴露任何 Node/文件能力。
 */
contextBridge.exposeInMainWorld('__tdInject', {
  getPayload: () => ipcRenderer.invoke('wechat:get-payload'),
})
