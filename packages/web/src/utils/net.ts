/** 跨域抓取通道：桌面版走主进程代理（无同源限制），网页版浏览器直连（受 CORS 约束） */
export async function fetchText(url: string): Promise<string> {
  if (window.desktopAPI?.fetchText) return window.desktopAPI.fetchText(url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}
