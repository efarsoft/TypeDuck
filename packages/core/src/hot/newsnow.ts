/** NewsNow 热榜（开源项目 ourongxing/newsnow）：
 *  GET {base}/api/s?id=<源>，免 Key；条目由服务端缓存约 1 小时。
 *  公共实例不带 CORS 头——网页版直连受限，桌面版走主进程代理（fetchText 注入）。 */

export interface HotSource {
  id: string
  title: string
}

export interface HotItem {
  title: string
  url: string
  /** 热度/额外信息，如「1498 万热度」 */
  info?: string
}

/** 文章向精选源（面向非技术创作者；后续增删改这里即可） */
export const HOT_SOURCES: HotSource[] = [
  { id: 'weibo', title: '微博' },
  { id: 'baidu', title: '百度热搜' },
  { id: 'zhihu', title: '知乎' },
  { id: 'toutiao', title: '今日头条' },
  { id: '36kr', title: '36氪' },
  { id: 'juejin', title: '稀土掘金' },
]

export const DEFAULT_NEWSNOW_BASE = 'https://newsnow.busiyi.world'

export class HotApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HotApiError'
    this.status = status
  }
}

/** 文本抓取器：默认浏览器 fetch（受 CORS 约束）；桌面版注入主进程代理版本 */
export type FetchText = (url: string) => Promise<string>

async function defaultFetchText(url: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new HotApiError(
      '无法访问热榜实例：网页版受跨域（CORS）限制，桌面版不受影响；也可在设置里更换实例地址',
      0,
    )
  }
  if (!res.ok) throw new HotApiError(`请求失败（HTTP ${res.status}）`, res.status)
  return res.text()
}

interface NewsNowItem {
  id: string
  title: string
  url: string
  extra?: { info?: string }
}

/** 拉取指定源的条目列表 */
export async function fetchHotItems(
  baseUrl: string,
  sourceId: string,
  fetchText: FetchText = defaultFetchText,
): Promise<HotItem[]> {
  const base = baseUrl.replace(/\/+$/, '')
  const text = await fetchText(`${base}/api/s?id=${encodeURIComponent(sourceId)}`)
  let data: { status?: string; items?: NewsNowItem[] }
  try {
    data = JSON.parse(text) as { status?: string; items?: NewsNowItem[] }
  } catch {
    throw new HotApiError('实例返回的不是有效数据，请检查实例地址', 0)
  }
  if (!Array.isArray(data.items)) throw new HotApiError('实例返回数据异常，请稍后重试', 0)
  return data.items
    .filter((it) => it.title && it.url)
    .map((it) => ({ title: it.title, url: it.url, info: it.extra?.info?.trim() || undefined }))
}
