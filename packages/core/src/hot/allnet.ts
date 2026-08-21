/** allnet.hot 热榜聚合 API（Open v1）：一个 Key 订阅约 50 个榜单源。
 *  实测 CORS 全开放（含 X-API-Key 预检），网页版可直连；限额每日 2000 次 / 每秒 10 次。 */

const BASE = 'https://api.allnet.hot/api/open/v1'

export interface HotSource {
  id: number
  title: string
}

export interface HotItem {
  title: string
  image_url: string
  jump_url: string
}

export class HotApiError extends Error {
  /** HTTP 状态码；0 表示网络层失败 */
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HotApiError'
    this.status = status
  }
}

interface Envelope<T> {
  code: number
  message: string
  data: T
}

async function request<T>(path: string, key: string): Promise<T> {
  if (!key) throw new HotApiError('未配置热榜 API Key', 0)
  let res: Response
  try {
    res = await fetch(BASE + path, { headers: { 'X-API-Key': key } })
  } catch {
    throw new HotApiError('网络错误：无法连接 allnet.hot', 0)
  }
  if (!res.ok) {
    const hint =
      res.status === 401
        ? 'API Key 无效，请检查或重新获取'
        : res.status === 429
          ? '请求超限（每日 2000 次 / 每秒 10 次），稍后再试'
          : `请求失败（HTTP ${res.status}）`
    throw new HotApiError(hint, res.status)
  }
  const body = (await res.json()) as Envelope<T>
  if (body.code !== 200) throw new HotApiError(body.message || `接口返回异常（code ${body.code}）`, body.code)
  return body.data
}

/** 榜单源列表（知乎热榜 / 微博热搜等，运行时获取，不写死） */
export async function fetchHotSources(key: string): Promise<HotSource[]> {
  const data = await request<{ list: HotSource[] }>('/sources?page=1', key)
  return data.list ?? []
}

/** 指定源的条目列表 */
export async function fetchHotItems(key: string, sourceId: number): Promise<HotItem[]> {
  const data = await request<{ list: HotItem[] }>(`/sources/data?id=${sourceId}`, key)
  return data.list ?? []
}
