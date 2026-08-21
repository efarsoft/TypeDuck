/**
 * S3 兼容图床客户端（Cloudflare R2 / 阿里云 OSS / 腾讯云 COS / 七牛 / minio 等）。
 * 浏览器端直传：AWS Signature V4 签名用 Web Crypto 实现，密钥不经过任何服务器。
 */

export interface OssConfig {
  /** 服务商预设：r2 | aliyun | tencent | qiniu | custom */
  provider: string
  /** S3 兼容端点，如 https://<account>.r2.cloudflarestorage.com */
  endpoint: string
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  /** 上传后用于访问的公开域名（CDN/自定义域），如 https://img.example.com */
  publicBaseUrl: string
  /** 对象名前缀（目录），如 articles/ */
  prefix: string
}

export const OSS_PRESETS: { id: string; name: string; endpointHint: string; regionHint: string; docs: string }[] = [
  {
    id: 'r2',
    name: 'Cloudflare R2',
    endpointHint: 'https://<账户ID>.r2.cloudflarestorage.com',
    regionHint: 'auto',
    docs: 'https://developers.cloudflare.com/r2/',
  },
  {
    id: 'aliyun',
    name: '阿里云 OSS',
    endpointHint: 'https://oss-<地域>.aliyuncs.com',
    regionHint: 'oss-cn-hangzhou 等',
    docs: 'https://help.aliyun.com/zh/oss/',
  },
  {
    id: 'tencent',
    name: '腾讯云 COS',
    endpointHint: 'https://cos.<地域>.myqcloud.com',
    regionHint: 'ap-guangzhou 等',
    docs: 'https://cloud.tencent.com/document/product/436',
  },
  {
    id: 'custom',
    name: '自定义 S3 兼容',
    endpointHint: 'https://s3.example.com',
    regionHint: 'us-east-1',
    docs: '',
  },
]

export class OssError extends Error {}

/* ---------- SigV4 工具 ---------- */

const enc = new TextEncoder()

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? key : new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}
async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const buf = typeof data === 'string' ? enc.encode(data) : data
  const digest = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** S3 兼容路径风格 PUT 上传（R2/OSS/COS 均支持 path-style 或自动兼容） */
export async function ossUpload(
  config: OssConfig,
  bytes: Uint8Array,
  contentType: string,
  objectName: string,
): Promise<string> {
  if (!config.endpoint || !config.bucket || !config.accessKeyId || !config.secretAccessKey) {
    throw new OssError('图床配置不完整：Endpoint / Bucket / AccessKey 都要填')
  }
  const url = new URL(config.endpoint.replace(/\/+$/, ''))
  const host = url.host
  // path-style：/<bucket>/<object>（R2 必须；OSS/COS 也兼容）
  const canonicalPath = `/${config.bucket}/${objectName.split('/').map(encodeURIComponent).join('/')}`
  const fullUrl = `${url.origin}${canonicalPath}`

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '') // 20260821T120000Z
  const dateStamp = amzDate.slice(0, 8)
  const payloadHash = await sha256Hex(bytes)

  // 微妙但关键：path 的 URI 编码规则（SigV4 要求 / 不编码、其余按 RFC3986）
  const canonicalUri = `/${config.bucket}/${objectName
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')}`

  const canonicalHeaders =
    `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join('\n')

  const kDate = await hmac(enc.encode(`AWS4${config.secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, config.region)
  const kService = await hmac(kRegion, 's3')
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = [...new Uint8Array(await hmac(kSigning, stringToSign))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  let res: Response
  try {
    res = await fetch(fullUrl, {
      method: 'PUT',
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Content-Type': contentType,
      },
      body: bytes as BodyInit,
    })
  } catch {
    throw new OssError('网络错误：无法连接图床（检查 Endpoint 与跨域 CORS 配置）')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new OssError(`图床上传失败（HTTP ${res.status}）${text.slice(0, 200)}`)
  }

  const publicBase = config.publicBaseUrl.replace(/\/+$/, '')
  return publicBase ? `${publicBase}/${objectName}` : `${url.origin}/${config.bucket}/${objectName}`
}

/** 生成对象名：<prefix>typeduck-<时间戳>-<随机>.<ext> */
export function ossObjectName(config: OssConfig, ext: string): string {
  const prefix = config.prefix ? config.prefix.replace(/^\/+|\/+$/g, '') + '/' : ''
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}typeduck-${Date.now().toString(36)}-${rand}.${ext || 'png'}`
}
