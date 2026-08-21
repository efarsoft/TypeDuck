/**
 * 图片插入管线：
 * - 配置了图床 → 上传 OSS → markdown 插入永久 URL（多平台复用）
 * - 未配置 → IndexedDB 本地暂存，markdown 插入 tdimg:// 协议引用（发布时直传素材库）
 */
import { ossUpload, ossObjectName, type OssConfig } from '@typeduck/core'

const STORE = 'typeduck:oss'
const DB_NAME = 'typeduck-images'
const STORE_NAME = 'images'

export interface LocalImageRef {
  scheme: 'tdimg'
  id: string
}

export function getOssConfig(): OssConfig | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const cfg = JSON.parse(raw) as OssConfig
    if (cfg.endpoint && cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey) return cfg
  } catch { /* 忽略 */ }
  return null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function putImage(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getImage(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return blob
}

export function tdimgUrl(id: string): string {
  return `tdimg://${id}`
}

export function parseTdimg(url: string): string | null {
  const m = url.match(/^tdimg:\/\/([\w-]+)$/)
  return m ? m[1] : null
}

/* ---------- tdimg → blob URL（预览渲染用） ---------- */

const blobUrls = new Map<string, string>()

function rememberBlob(id: string, blob: Blob): string {
  const existing = blobUrls.get(id)
  if (existing) return existing
  const url = URL.createObjectURL(blob)
  blobUrls.set(id, url)
  return url
}

/** 把 HTML 里的 tdimg:// 引用替换成 blob URL（同步，配合 hydrate 使用） */
export function resolveTdimgs(html: string): string {
  return html.replace(/tdimg:\/\/([\w-]+)/g, (_, id) => blobUrls.get(id) ?? _)
}

/** 扫描文档内容，为所有 tdimg 引用从 IndexedDB 恢复 blob URL（挂载时调用一次） */
export async function hydrateTdimgs(content: string): Promise<void> {
  const ids = [...content.matchAll(/tdimg:\/\/([\w-]+)/g)].map((m) => m[1])
  for (const id of new Set(ids)) {
    if (blobUrls.has(id)) continue
    const blob = await getImage(id)
    if (blob) rememberBlob(id, blob)
  }
}

/** 取回图片字节（发布转素材库用）：tdimg 走 IndexedDB，https 直接下载（需图床开 CORS） */
export async function fetchImageBytes(
  url: string,
  proxyFetch?: (url: string) => Promise<{ status: number; text: string }>,
): Promise<{ bytes: ArrayBuffer; type: string; name: string } | null> {
  const tdId = parseTdimg(url)
  if (tdId) {
    const blob = await getImage(tdId)
    if (!blob) return null
    return {
      bytes: await blob.arrayBuffer(),
      type: blob.type || 'image/png',
      name: `${tdId}.${(blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg')}`,
    }
  }
  const res = await fetch(url)
  if (!res.ok) return null
  const blob = await res.blob()
  return {
    bytes: await blob.arrayBuffer(),
    type: blob.type || 'image/jpeg',
    name: 'image.' + ((blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')),
  }
}

export interface InsertedImage {
  /** markdown 里的 src */
  src: string
  alt: string
}

/**
 * 处理用户选中的图片文件：上传图床或本地暂存，返回 markdown 图片语法。
 * tdimg:// 在预览渲染时由渲染层换成 blob URL（见 render 层的替换钩子）。
 */
export async function insertImage(file: File): Promise<InsertedImage> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const alt = file.name.replace(/\.[^.]+$/, '')

  const oss = getOssConfig()
  if (oss) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const objectName = ossObjectName(oss, ext)
    const url = await ossUpload(oss, bytes, file.type || 'image/png', objectName)
    return { src: url, alt }
  }

  // 本地暂存路径
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await putImage(id, file)
  return { src: tdimgUrl(id), alt }
}
