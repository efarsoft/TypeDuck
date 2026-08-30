/** Electron preload 注入的桌面能力（仅桌面版存在） */
interface DesktopAPI {
  isDesktop: true
  platform: string
  openFile(): Promise<{ filePath: string; content: string; title: string } | null>
  saveFile(filePath: string, content: string): Promise<{ filePath: string }>
  saveFileDialog(content: string, defaultPath?: string): Promise<{ filePath: string } | null>
  /** 选择文档存储文件夹（数据镜像），返回路径或 null（取消） */
  selectDataDir(): Promise<string | null>
  /** 重新授权已配置的存储文件夹（应用重启后授权丢失，目录必须存在） */
  authorizeDataDir(dir: string): Promise<string>
  /** 全量镜像文档到存储文件夹：分配文件名、写 index.json 与各 .md，返回 { dir, count } */
  writeDataDir(
    dir: string,
    docs: { id: string; title: string; content: string }[],
  ): Promise<{ dir: string; count: number }>
  /** 读取存储文件夹的 index 与全部 .md 内容 */
  readDataDir(dir: string): Promise<{
    index: { docs: { id: string; title: string; file: string; updatedAt: number }[] }
    docs: { file: string; content: string }[]
  }>
  /** 清空存储文件夹内由应用管理的文件（index.json + 各 .md） */
  clearDataDir(dir: string): Promise<void>
  onMenu(channel: string, callback: () => void): () => void
  /** 主进程代理抓取公开数据（仅 https GET），返回响应文本 */
  fetchText(url: string): Promise<string>
  /** 主进程通用 https 请求（微信草稿箱等 POST 接口用） */
  request(
    url: string,
    options: { method?: string; headers?: Record<string, string>; body?: ArrayBuffer | string },
  ): Promise<{ status: number; text: string }>
  /** 注入当前文档到公众号编辑器：打开/聚焦微信后台并尝试注入（needPage 提示需在编辑页重试） */
  injectWechat(html: string, title: string): Promise<{ ok: boolean; needPage?: boolean; msg?: string }>
}

interface Window {
  desktopAPI?: DesktopAPI
}
