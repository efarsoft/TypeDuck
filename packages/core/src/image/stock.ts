/** 免费图库搜索（Unsplash / Pexels 官方 API，均开放 CORS，浏览器直连） */

export type ImageProvider = 'unsplash' | 'pexels'

export interface ImageResult {
  thumb: string
  full: string
  author: string
  authorUrl: string
  width: number
  height: number
  source: ImageProvider
}

export class ImageApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ImageApiError'
    this.status = status
  }
}

function toError(status: number): ImageApiError {
  const hint =
    status === 401
      ? 'API Key 无效，请检查'
      : status === 403
        ? 'Key 无权限或触发限流，稍后再试'
        : status === 429
          ? '请求太频繁（Unsplash 每小时 50 次 / Pexels 每小时 200 次），稍后再试'
          : `请求失败（HTTP ${status}）`
  return new ImageApiError(hint, status)
}

/** Unsplash：client_id 参数鉴权 */
async function searchUnsplash(key: string, query: string): Promise<ImageResult[]> {
  let res: Response
  try {
    res = await fetch(
      `https://api.unsplash.com/search/photos?per_page=24&query=${encodeURIComponent(query)}&client_id=${encodeURIComponent(key)}`,
    )
  } catch {
    throw new ImageApiError('网络错误：无法连接 Unsplash', 0)
  }
  if (!res.ok) throw toError(res.status)
  const data = (await res.json()) as {
    results: {
      urls: { thumb: string; regular: string }
      user: { name: string; links: { html: string } }
      width: number
      height: number
    }[]
  }
  return data.results.map((r) => ({
    thumb: r.urls.thumb,
    full: r.urls.regular,
    author: r.user?.name ?? 'Unknown',
    authorUrl: r.user?.links?.html ?? '',
    width: r.width,
    height: r.height,
    source: 'unsplash' as const,
  }))
}

/** Pexels：Authorization 头鉴权 */
async function searchPexels(key: string, query: string): Promise<ImageResult[]> {
  let res: Response
  try {
    res = await fetch(
      `https://api.pexels.com/v1/search?per_page=24&query=${encodeURIComponent(query)}`,
      { headers: { Authorization: key } },
    )
  } catch {
    throw new ImageApiError('网络错误：无法连接 Pexels', 0)
  }
  if (!res.ok) throw toError(res.status)
  const data = (await res.json()) as {
    photos: {
      src: { tiny: string; large: string }
      photographer: string
      url: string
      width: number
      height: number
    }[]
  }
  return data.photos.map((p) => ({
    thumb: p.src.tiny,
    full: p.src.large,
    author: p.photographer ?? 'Unknown',
    authorUrl: p.url ?? '',
    width: p.width,
    height: p.height,
    source: 'pexels' as const,
  }))
}

export async function searchStockImages(provider: ImageProvider, key: string, query: string): Promise<ImageResult[]> {
  if (!key) throw new ImageApiError('未配置图库 API Key', 0)
  return provider === 'pexels' ? searchPexels(key, query) : searchUnsplash(key, query)
}
