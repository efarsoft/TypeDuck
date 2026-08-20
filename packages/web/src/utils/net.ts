/**
 * 跨域抓取通道（按优先级）：
 * 1. 桌面版：Electron 主进程代理（无同源限制）
 * 2. 网页版：同源代读 /api/fetch（生产 = Vercel 函数，开发 = Vite 中间件）
 * 3. 兜底：浏览器直连（仅对开了 CORS 的站点生效，如自部署场景）
 */
export async function fetchText(url: string): Promise<string> {
  if (window.desktopAPI?.fetchText) return window.desktopAPI.fetchText(url)

  const proxy = `/api/fetch?url=${encodeURIComponent(url)}`
  try {
    const res = await fetch(proxy)
    if (res.ok) return res.text()
  } catch {
    /* 代理不可用（如自部署静态托管未配函数），落到直连 */
  }

  const direct = await fetch(url)
  if (!direct.ok) throw new Error(`HTTP ${direct.status}`)
  return direct.text()
}
