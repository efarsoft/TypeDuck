/**
 * 配置统一读取层：所有面板从这里读配置，SettingsCenter 是唯一写入点。
 * 避免 ImagePanel / PublishDialog / HotPanel 各自内嵌表单导致认知负担和双份维护。
 */

export interface WechatCfg { appId: string; appSecret: string }
export interface ImageCfg { provider: 'unsplash' | 'pexels'; key: string }
export interface OssCfg {
  provider: string; endpoint: string; bucket: string; region: string
  accessKeyId: string; secretAccessKey: string; publicBaseUrl: string; prefix: string
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback
  } catch {
    return fallback
  }
}

export function getWechatCfg(): WechatCfg {
  return loadJson('typeduck:wechat', { appId: '', appSecret: '' })
}
export function isWechatConfigured(): boolean {
  const c = getWechatCfg()
  return !!(c.appId && c.appSecret)
}

export function getImageCfg(): ImageCfg {
  return loadJson('typeduck:imageConfig', { provider: 'unsplash', key: '' })
}
export function isImageConfigured(): boolean {
  return !!getImageCfg().key
}

export function getHotKey(): string {
  return localStorage.getItem('typeduck:hotKey') ?? ''
}
export function isHotConfigured(): boolean {
  return !!getHotKey()
}

export function getOssCfg(): OssCfg {
  return loadJson('typeduck:oss', {
    provider: 'r2', endpoint: '', bucket: '', region: 'auto',
    accessKeyId: '', secretAccessKey: '', publicBaseUrl: '', prefix: '',
  })
}
export function isOssConfigured(): boolean {
  const c = getOssCfg()
  return !!(c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey)
}
