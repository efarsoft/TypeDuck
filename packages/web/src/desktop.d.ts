/** Electron preload 注入的桌面能力（仅桌面版存在） */
interface DesktopAPI {
  isDesktop: true
  platform: string
  openFile(): Promise<{ filePath: string; content: string; title: string } | null>
  saveFile(filePath: string, content: string): Promise<{ filePath: string }>
  saveFileDialog(content: string, defaultPath?: string): Promise<{ filePath: string } | null>
  onMenu(channel: string, callback: () => void): () => void
  /** 主进程代理抓取公开数据（仅 https GET），返回响应文本 */
  fetchText(url: string): Promise<string>
  /** 主进程通用 https 请求（微信草稿箱等 POST 接口用） */
  request(
    url: string,
    options: { method?: string; headers?: Record<string, string>; body?: ArrayBuffer | string },
  ): Promise<{ status: number; text: string }>
}

interface Window {
  desktopAPI?: DesktopAPI
}
