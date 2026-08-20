import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 开发期同款代读中间件：与生产环境的 Vercel 函数同路径（/api/fetch），
 * 浏览器开发调试热点/链接改写时不再受 CORS 限制。
 */
function devFetchProxy(): Plugin {
  return {
    name: 'dev-fetch-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost').searchParams.get('url')
        if (!url || !/^https?:\/\//i.test(url)) {
          res.statusCode = 400
          res.end('bad url')
          return
        }
        try {
          const r = await fetch(url, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(15_000),
          })
          res.statusCode = r.status
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end((await r.text()).slice(0, 3_000_000))
        } catch {
          res.statusCode = 502
          res.end('upstream error')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), devFetchProxy()],
  // 相对路径：桌面版 file:// 协议加载 dist 时，绝对路径 /assets 会指向磁盘根目录导致白屏
  base: './',
  server: {
    port: 5173,
  },
})
