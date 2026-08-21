/* 排版鸭 Service Worker：离线壳 + 静态资源缓存（编辑器数据在 IndexedDB 本来就离线） */
const CACHE = 'typeduck-v1'
const PRECACHE = [
  '/',
  '/editor.html',
  '/manifest.json',
  '/logo.webp',
  '/logo-h.webp',
  '/favicon.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(PRECACHE.map((u) => c.add(u)))),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // 只处理同源 GET；API 调用与跨域图床直连不走缓存
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // /api/ 代理不走缓存
  if (url.pathname.startsWith('/api/')) return

  // Hash 构建产物（/assets/xxx.js）→ 缓存优先
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(e.request, copy))
            return res
          }),
      ),
    )
    return
  }

  // 页面与其它资源 → 网络优先，离线回退缓存
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return res
      })
      .catch(() => caches.match(e.request)),
  )
})
