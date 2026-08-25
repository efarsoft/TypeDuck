/**
 * CORS 代理服务（替代 Vercel serverless 函数）
 * 用途：网页版的热点榜单 / 链接改写需要跨域抓取，浏览器直连被 CORS 拦截
 * 部署：Node 18+ 直接 node server.js，或 Docker 容器
 */
const http = require('http')

const PORT = process.env.PORT || 3210
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'

http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method !== 'GET') { res.writeHead(405); return res.end('method not allowed') }

  const url = new URL(req.url, `http://localhost:${PORT}`).searchParams.get('url')
  if (!url || !/^https:\/\//i.test(url)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    return res.end('bad url')
  }

  // 防滥用：仅允许本站来源（未带 Origin 的 curl 健康检查放行）
  const origin = req.headers.origin || ''
  if (origin && !origin.includes('efarsoft.com') && !origin.includes('localhost')) {
    res.writeHead(403)
    return res.end('forbidden')
  }

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })
    const text = (await upstream.text()).slice(0, 3_000_000)
    res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(text)
  } catch {
    res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end('upstream error')
  }
}).listen(PORT, () => {
  console.log(`CORS proxy running on :${PORT}`)
})
