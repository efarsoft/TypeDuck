/** 轻量 IndexedDB 封装：documents 表 + history 表（每文档最多 30 个历史版本） */

export interface Doc {
  id: string
  title: string
  content: string
  themeId: string
  createdAt: number
  updatedAt: number
  tags: string[]
  status: 'draft' | 'writing' | 'published'
  wordCount: number
  estimatedReadTime: number
}

export interface DocHistory {
  id: string
  docId: string
  content: string
  title: string
  savedAt: number
}

const DB_NAME = 'typeduck'
const DB_VERSION = 1
const DOC_STORE = 'documents'
const HISTORY_STORE = 'history'
const MAX_HISTORY = 30

/** crypto.randomUUID 仅在安全上下文（https/localhost）可用，提供兜底 */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        db.createObjectStore(HISTORY_STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode)
        const req = fn(transaction.objectStore(storeName))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function getAllDocs(): Promise<Doc[]> {
  const docs = await tx<Doc[]>(DOC_STORE, 'readonly', (s) => s.getAll())
  return docs.sort((a, b) => b.updatedAt - a.updatedAt)
}

export function putDoc(doc: Doc): Promise<void> {
  return tx(DOC_STORE, 'readwrite', (s) => s.put(doc)).then(() => undefined)
}

export function deleteDoc(id: string): Promise<void> {
  return Promise.all([
    tx(DOC_STORE, 'readwrite', (s) => s.delete(id)),
    // 同步删除该文档的历史版本
    getHistory(id).then((items) =>
      Promise.all(items.map((h) => tx(HISTORY_STORE, 'readwrite', (s) => s.delete(h.id)))),
    ),
  ]).then(() => undefined)
}

export function addHistory(doc: Doc): Promise<void> {
  const entry: DocHistory = {
    id: uuid(),
    docId: doc.id,
    title: doc.title,
    content: doc.content,
    savedAt: Date.now(),
  }
  return tx(HISTORY_STORE, 'readwrite', (s) => s.add(entry))
    .then(() => tx<DocHistory[]>(HISTORY_STORE, 'readonly', (s) => s.getAll()))
    .then((items) => {
      const mine = items
        .filter((h) => h.docId === doc.id)
        .sort((a, b) => b.savedAt - a.savedAt)
      const stale = mine.slice(MAX_HISTORY)
      return Promise.all(
        stale.map((h) => tx(HISTORY_STORE, 'readwrite', (s) => s.delete(h.id))),
      )
    })
    .then(() => undefined)
}

export async function getHistory(docId: string): Promise<DocHistory[]> {
  const items = await tx<DocHistory[]>(HISTORY_STORE, 'readonly', (s) => s.getAll())
  return items.filter((h) => h.docId === docId).sort((a, b) => b.savedAt - a.savedAt)
}

export function deleteHistory(id: string): Promise<void> {
  return tx(HISTORY_STORE, 'readwrite', (s) => s.delete(id)).then(() => undefined)
}
