/**
 * 微信公众号「草稿箱」发布（材料 API）。
 * 流程：access_token（2 小时有效，缓存）→ 上传封面为永久素材 → 创建草稿。
 * 注意：api.weixin.qq.com 不支持浏览器跨域直连，且有 IP 白名单机制——
 * 请求必须经桌面主进程代理（用户自己的 IP，需在公众号后台加入白名单）。
 */

export interface WechatConfig {
  appId: string
  appSecret: string
}

export interface WechatRequestInit {
  method?: string
  headers?: Record<string, string>
  body?: ArrayBuffer | string
}

/** 请求通道：桌面版注入主进程代理；浏览器直连会被微信拒绝 */
export type WechatRequester = (
  url: string,
  init: WechatRequestInit,
) => Promise<{ status: number; text: string }>

export class WechatApiError extends Error {
  /** 微信错误码；0 表示网络/通道层失败 */
  readonly code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'WechatApiError'
    this.code = code
  }
}

const API = 'https://api.weixin.qq.com/cgi-bin'

/** token 提前 5 分钟过期，避免边界失败 */
const TOKEN_MARGIN_MS = 5 * 60 * 1000
let tokenCache: { token: string; expiresAt: number } | null = null

function translate(code: number, errmsg: string): string {
  switch (code) {
    case 40013:
      return 'AppID 无效，请检查开发者配置'
    case 40125:
    case 41004:
      return 'AppSecret 无效，请检查开发者配置'
    case 40164:
      return `IP 不在白名单：请把错误信息中的 IP 加进公众号后台「基本配置 → IP 白名单」（${errmsg}）`
    case 40001:
    case 42001:
      return 'access_token 无效或已过期，请重试'
    case 48001:
      return '该接口未授权（草稿箱接口可能需要认证账号）'
    case 45009:
      return '触发接口频率限制，请稍后重试'
    default:
      return `${errmsg || '接口调用失败'}（code ${code}）`
  }
}

async function callApi(
  requester: WechatRequester,
  url: string,
  init: WechatRequestInit = {},
): Promise<Record<string, unknown>> {
  let res: { status: number; text: string }
  try {
    res = await requester(url, init)
  } catch {
    throw new WechatApiError('网络错误：无法连接微信接口（需桌面版，且本机网络可达 api.weixin.qq.com）', 0)
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(res.text) as Record<string, unknown>
  } catch {
    throw new WechatApiError(`接口返回异常（HTTP ${res.status}）`, 0)
  }
  if (typeof data.errcode === 'number' && data.errcode !== 0) {
    throw new WechatApiError(translate(data.errcode, String(data.errmsg ?? '')), data.errcode)
  }
  return data
}

export async function getWechatAccessToken(
  config: WechatConfig,
  requester: WechatRequester,
  force = false,
): Promise<string> {
  if (!force && tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token
  if (!config.appId || !config.appSecret) throw new WechatApiError('请先配置公众号 AppID / AppSecret', 0)
  const data = await callApi(
    requester,
    `${API}/token?grant_type=client_credential&appid=${encodeURIComponent(config.appId)}&secret=${encodeURIComponent(config.appSecret)}`,
  )
  const token = data.access_token as string
  const expiresIn = Number(data.expires_in ?? 7200)
  tokenCache = { token, expiresAt: Date.now() + expiresIn * 1000 - TOKEN_MARGIN_MS }
  return token
}

/** token 失效自动刷新重试一次 */
async function withToken<T>(
  config: WechatConfig,
  requester: WechatRequester,
  fn: (token: string) => Promise<T>,
): Promise<T> {
  const token = await getWechatAccessToken(config, requester)
  try {
    return await fn(token)
  } catch (err) {
    if (err instanceof WechatApiError && (err.code === 40001 || err.code === 42001)) {
      const fresh = await getWechatAccessToken(config, requester, true)
      return fn(fresh)
    }
    throw err
  }
}

export interface WechatCoverFile {
  name: string
  type: string
  bytes: ArrayBuffer
}

/** 手工拼 multipart（FormData 无法跨 IPC 传输） */
function buildMultipart(file: WechatCoverFile): { body: ArrayBuffer; contentType: string } {
  const boundary = `----typeduck${Date.now().toString(36)}`
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${file.name}"\r\n` +
    `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`
  const tail = `\r\n--${boundary}--\r\n`
  const headBytes = new TextEncoder().encode(head)
  const tailBytes = new TextEncoder().encode(tail)
  const body = new Uint8Array(headBytes.length + file.bytes.byteLength + tailBytes.length)
  body.set(headBytes, 0)
  body.set(new Uint8Array(file.bytes), headBytes.length)
  body.set(tailBytes, headBytes.length + file.bytes.byteLength)
  return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` }
}

/** 上传封面为永久图片素材，返回 thumb_media_id */
export async function uploadWechatCover(
  config: WechatConfig,
  requester: WechatRequester,
  file: WechatCoverFile,
): Promise<{ mediaId: string; url: string }> {
  const { body, contentType } = buildMultipart(file)
  return withToken(config, requester, async (token) => {
    const data = await callApi(requester, `${API}/material/add_material?access_token=${token}&type=image`, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    return { mediaId: String(data.media_id), url: String(data.url ?? '') }
  })
}

export interface WechatDraftArticle {
  /** ≤ 64 字 */
  title: string
  author?: string
  /** 摘要 ≤ 120 字 */
  digest?: string
  /** 内联样式的完整 HTML */
  contentHtml: string
  thumbMediaId: string
}

/** 创建草稿；正式发布由用户在公众号后台人工完成 */
export async function publishWechatDraft(
  config: WechatConfig,
  requester: WechatRequester,
  article: WechatDraftArticle,
): Promise<{ mediaId: string }> {
  return withToken(config, requester, async (token) => {
    const data = await callApi(requester, `${API}/draft/add?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        articles: [
          {
            title: article.title,
            author: article.author ?? '',
            digest: article.digest ?? '',
            content: article.contentHtml,
            thumb_media_id: article.thumbMediaId,
            need_open_comment: 0,
            only_fans_can_comment: 0,
          },
        ],
      }),
    })
    return { mediaId: String(data.media_id) }
  })
}
