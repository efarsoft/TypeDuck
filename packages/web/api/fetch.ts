/**
 * Vercel Serverless 函数：同源代读外部内容，绕开浏览器 CORS 限制。
 * 网页版的热点榜单 / 链接改写都经此通道（桌面版走 Electron 主进程代理，不经这里）。
 *
 * 防滥用：仅允许本站来源调用；响应截断 3MB；15 秒超时。
 */

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

const MAX_SIZE = 3_000_000

export default async function handler(req: Request): Promise<Response> {
  const { searchParams, origin: site } = new URL(req.url)
  const target = searchParams.get('url')
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response('bad url', { status: 400 })
  }

  // 防滥用：带 Origin/Referer 的请求必须来自本站（无头请求如健康检查放行）
  const reqOrigin = req.headers.get('origin')
  const referer = req.headers.get('referer')
  if ((reqOrigin && reqOrigin !== site) || (referer && !referer.startsWith(site))) {
    return new Response('forbidden', { status: 403 })
  }

  try {
    const res = await fetch(target, {
      headers: { 'User-Agent': BROWSER_UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    const text = (await res.text()).slice(0, MAX_SIZE)
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch {
    return new Response('upstream error', { status: 502 })
  }
}
