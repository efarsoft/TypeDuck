/** Electron preload 注入的桌面能力（仅桌面版存在） */
interface DesktopAPI {
  isDesktop: true
  platform: string
  openFile(): Promise<{ filePath: string; content: string; title: string } | null>
  saveFile(filePath: string, content: string): Promise<{ filePath: string }>
  saveFileDialog(content: string, defaultPath?: string): Promise<{ filePath: string } | null>
  onMenu(channel: string, callback: () => void): () => void
}

interface Window {
  desktopAPI?: DesktopAPI
}
