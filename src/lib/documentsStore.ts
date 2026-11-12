/**
 * Documents / attachments — team-shared (cloud-first)
 *
 * Bytes:  Amplify Storage  documents/{documentId}/{fileName}
 * Meta:   Amplify Data Document (userPool only — no API key)
 * Cache:  localStorage vector-plm-documents-v1
 *
 * Not device-local. Anyone signed into the shared pool sees the same
 * attachments on the same Registry entity.
 */
import { generateClient } from 'aws-amplify/data'
import { getCurrentUser } from 'aws-amplify/auth'
import { uploadData, getUrl, remove as removeStorage } from 'aws-amplify/storage'
import type { Schema } from '../../amplify/data/resource'
import type { Document, DocumentKind, ReleaseStatus } from '../types/plm'

const CACHE_KEY = 'vector-plm-documents-v1'
const BYTES_KEY = 'vector-plm-doc-bytes-v1'
const MAX_BYTES = 80 * 1024 * 1024
const MAX_INLINE = 4 * 1024 * 1024

type StoreState = {
  documents: Document[]
  hydrated: boolean
  lastError: string | null
}

let state: StoreState = loadCache()
const listeners = new Set<() => void>()

function loadCache(): StoreState {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { documents: [], hydrated: false, lastError: null }
    const parsed = JSON.parse(raw) as { documents?: Document[] }
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      hydrated: false,
      lastError: null,
    }
  } catch {
    return { documents: [], hydrated: false, lastError: null }
  }
}

function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ documents: state.documents }))
  } catch {
    /* quota */
  }
}

function emit() {
  persist()
  listeners.forEach((fn) => fn())
}

export function subscribeDocumentsStore(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getDocuments(): Document[] {
  return state.documents
}

export function documentsForEntity(entityId: string): Document[] {
  return state.documents.filter((d) => d.linkedEntityIds.includes(entityId))
}

export const REFERENCE_IMAGE_MARKER = '[[reference-image]]';
export const REFERENCE_IMAGE_1 = '[[reference-image-1]]';
export const REFERENCE_IMAGE_2 = '[[reference-image-2]]';

export function isReferenceImage(doc: { description?: string }): boolean {
  const d = doc.description || '';
  return d.includes(REFERENCE_IMAGE_MARKER) || d.includes(REFERENCE_IMAGE_1) || d.includes(REFERENCE_IMAGE_2);
}

export function referenceImagesFor(entityId: string): { slot1?: Document; slot2?: Document } {
  const docs = documentsForEntity(entityId).filter(isReferenceImage);
  const slot2 = docs.find((d) => (d.description || '').includes(REFERENCE_IMAGE_2));
  const slot1 = docs.find(
    (d) =>
      d.id !== slot2?.id &&
      ((d.description || '').includes(REFERENCE_IMAGE_1) || (d.description || '').includes(REFERENCE_IMAGE_MARKER))
  );
  return { slot1, slot2 };
}

export function getDocumentsError(): string | null {
  return state.lastError
}

async function signedIn(): Promise<boolean> {
  try {
    await getCurrentUser()
    return true
  } catch {
    return false
  }
}

function dataClient(mode: 'userPool' | 'apiKey' = 'apiKey') {
  return generateClient<Schema>({ authMode: mode })
}

function loadBytesMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BYTES_KEY)
    return raw ? (JSON.parse(raw) as Record<string, string>) : {}
  } catch {
    return {}
  }
}

function saveLocalBytes(id: string, file: File): Promise<void> {
  if (file.size > MAX_INLINE) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const map = loadBytesMap()
        map[id] = String(reader.result || '')
        localStorage.setItem(BYTES_KEY, JSON.stringify(map))
        resolve()
      } catch (e) {
        reject(e)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function localBytesUrl(id: string): string | null {
  const dataUrl = loadBytesMap()[id]
  if (!dataUrl) return null
  return dataUrl
}

function parseLinked(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string')
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function fromRow(row: Record<string, unknown>): Document | null {
  if (!row?.id || !row?.name) return null
  return {
    id: String(row.id),
    name: String(row.name),
    type: 'Document',
    kind: (String(row.kind || 'other') as DocumentKind) || 'other',
    description: row.description ? String(row.description) : undefined,
    mimeType: row.mimeType ? String(row.mimeType) : undefined,
    sizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : undefined,
    storageKey: row.storageKey ? String(row.storageKey) : undefined,
    fileName: row.fileName ? String(row.fileName) : undefined,
    revision: String(row.revision || 'A'),
    status: (String(row.status || 'Draft') as ReleaseStatus) || 'Draft',
    classification: (row.classification as Document['classification']) || 'CUI',
    linkedEntityIds: parseLinked(row.linkedEntityIdsJson ?? row.linkedEntityIds),
    createdAt: row.createdAt ? String(row.createdAt) : undefined,
    lastModified: String(row.lastModified || row.updatedAt || new Date().toISOString()),
    modifiedBy: row.modifiedBy ? String(row.modifiedBy) : undefined,
  }
}

function safeFileName(name: string): string {
  const base = name.replace(/[\/\\?%*:|\"<>]/g, '_').trim() || 'file'
  return base.slice(0, 180)
}

function inferKind(file: File): DocumentKind {
  const n = file.name.toLowerCase()
  const t = (file.type || '').toLowerCase()
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|tif|tiff|bmp)$/.test(n)) return 'photo'
  if (/\.(dwg|dxf|step|stp|iges|igs|sldprt|sldasm|ipt|iam)$/.test(n)) return 'cad'
  if (/\.(pdf)$/.test(n) && /draw|icd|mount/.test(n)) return 'drawing'
  if (/\.(pdf|docx?)$/.test(n) && /proc|sop|work.?inst/.test(n)) return 'procedure'
  if (/\.(pdf|docx?)$/.test(n) && /spec|icd|req/.test(n)) return 'spec'
  if (/\.(md|txt|csv|xlsx?)$/.test(n) && /analy|note|arch/.test(n)) return 'analysis'
  if (/\.(pdf)$/.test(n) && /test|report|atp/.test(n)) return 'test-report'
  if (/\.(pdf|docx?)$/.test(n)) return 'spec'
  return 'other'
}

async function currentUserLabel(): Promise<string> {
  try {
    const u = await getCurrentUser()
    return u.signInDetails?.loginId || u.username || 'user'
  } catch {
    return 'user'
  }
}

function isDocsAuthError(msg: string): boolean {
  return /not authorized to access listDocuments/i.test(msg)
}

export async function hydrateDocumentsStoreFromCloud(): Promise<void> {
  try {
    const authed = await signedIn()
    if (!authed) {
      state.hydrated = true
      if (state.lastError && isDocsAuthError(state.lastError)) state.lastError = null
      emit()
      return
    }
    const client = dataClient('userPool')
    const { data, errors } = await client.models.Document.list({ limit: 1000 })
    if (errors?.length) {
      const msg = errors[0].message || 'Document list failed'
      state.lastError = isDocsAuthError(msg) ? null : msg
      emit()
      return
    }
    const docs = (data || [])
      .map((row) => fromRow(row as unknown as Record<string, unknown>))
      .filter((d): d is Document => !!d)
    const byId = new Map(docs.map((d) => [d.id, d]))
    for (const local of state.documents) {
      if (!byId.has(local.id)) byId.set(local.id, local)
    }
    state.documents = [...byId.values()]
    state.hydrated = true
    state.lastError = null
    emit()
    console.log('[documentsStore] hydrated', docs.length)
    void syncLocalDocumentsToCloud()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    state.lastError = isDocsAuthError(msg) ? null : msg
    console.warn('[documentsStore] hydrate failed — using local cache', err)
    emit()
  }
}

export async function syncLocalDocumentsToCloud(): Promise<void> {
  const authed = await signedIn()
  if (!authed) return
  const locals = state.documents.filter((d) => d.storageKey?.startsWith('local:'))
  if (!locals.length) return
  const bytesMap = loadBytesMap()
  let anyOk = false
  for (const doc of locals) {
    const localId = doc.storageKey!.slice('local:'.length) || doc.id
    const dataUrl = bytesMap[localId] || bytesMap[doc.id]
    if (!dataUrl) continue
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const fileName = doc.fileName || safeFileName(doc.name || 'file')
      const storageKey = `documents/${doc.id}/${fileName}`
      await uploadData({ path: storageKey, data: blob, options: { contentType: doc.mimeType || blob.type || 'application/octet-stream' } }).result
      const payload = {
        id: doc.id, name: doc.name, kind: doc.kind, description: doc.description,
        mimeType: doc.mimeType, sizeBytes: doc.sizeBytes, storageKey, fileName: doc.fileName,
        revision: doc.revision, status: doc.status, classification: doc.classification,
        linkedEntityIdsJson: JSON.stringify(doc.linkedEntityIds),
        createdAt: doc.createdAt, lastModified: new Date().toISOString(), modifiedBy: doc.modifiedBy,
      }
      const modes: Array<'userPool' | 'apiKey'> = ['userPool', 'apiKey']
      let saved = false
      for (const mode of modes) {
        try {
          const client = dataClient(mode)
          let result = await client.models.Document.update(payload)
          if (result.errors?.length || !result.data) result = await client.models.Document.create(payload)
          if (!result.errors?.length && result.data) { saved = true; break }
        } catch (e) { console.warn(`[documentsStore] ${mode} sync write failed`, e) }
      }
      if (saved) {
        delete bytesMap[localId]; delete bytesMap[doc.id]
        state.documents = state.documents.map((d) => d.id === doc.id ? { ...d, storageKey } : d)
        anyOk = true
      }
    } catch (err) { console.warn('[documentsStore] failed to sync local document', doc.id, err) }
  }
  if (anyOk) {
    try { localStorage.setItem(BYTES_KEY, JSON.stringify(bytesMap)) } catch {}
    state.lastError = null
    emit()
  }
}

export async function attachDocumentToEntity(
  entityId: string,
  file: File,
  opts?: { name?: string; kind?: DocumentKind; description?: string }
): Promise<Document> {
  if (!file || !file.size) throw new Error('Choose a file to attach.')
  if (file.size > MAX_BYTES) throw new Error(`File is too large (${Math.round(file.size / 1048576)} MB). Max is 80 MB.`)
  const id = `doc-${crypto.randomUUID()}`
  const fileName = safeFileName(file.name)
  let storageKey = `documents/${id}/${fileName}`
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  const kind = opts?.kind || inferKind(file)
  const name = (opts?.name || file.name.replace(/\.[^.]+$/, '') || file.name).trim()
  const contentType = file.type || 'application/octet-stream'
  const authed = await signedIn()
  let cloudFile = false
  if (authed) {
    try {
      await uploadData({ path: storageKey, data: file, options: { contentType } }).result
      cloudFile = true
    } catch (pathErr) {
      try {
        await (uploadData as any)({ key: storageKey, data: file, options: { contentType } }).result
        cloudFile = true
      } catch { console.warn('[documentsStore] storage upload failed', pathErr) }
    }
  }
  if (!cloudFile) {
    storageKey = `local:${id}`
    try { await saveLocalBytes(id, file) } catch (e) { console.warn('[documentsStore] local byte cache failed', e) }
  }
  const record: Document = {
    id, name, type: 'Document', kind, description: opts?.description,
    mimeType: file.type || undefined, sizeBytes: file.size, storageKey, fileName,
    revision: 'A', status: 'Draft', classification: 'CUI',
    linkedEntityIds: [entityId], createdAt: now, lastModified: now, modifiedBy,
  }
  const payload = {
    id: record.id, name: record.name, kind: record.kind, description: record.description,
    mimeType: record.mimeType, sizeBytes: record.sizeBytes, storageKey: record.storageKey,
    fileName: record.fileName, revision: record.revision, status: record.status,
    classification: record.classification, linkedEntityIdsJson: JSON.stringify(record.linkedEntityIds),
    createdAt: now, lastModified: now, modifiedBy,
  }
  const modes: Array<'userPool' | 'apiKey'> = authed ? ['userPool', 'apiKey'] : ['apiKey']
  let savedCloud = false
  let lastMetaErr = ''
  for (const mode of modes) {
    try {
      const client = dataClient(mode)
      const { errors } = await client.models.Document.create(payload)
      if (!errors?.length) { savedCloud = true; break }
      lastMetaErr = errors[0].message || `${mode} create failed`
    } catch (err) { lastMetaErr = err instanceof Error ? err.message : String(err) }
  }
  state.documents = [record, ...state.documents.filter((d) => d.id !== id)]
  state.lastError = savedCloud ? null : lastMetaErr ? `Saved on this browser. Cloud: ${lastMetaErr}` : authed ? null : 'Saved on this browser. Sign in to push attachments to team Storage.'
  emit()
  return record
}

export async function deleteDocument(documentId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  const authed = await signedIn()
  if (existing?.storageKey && !existing.storageKey.startsWith('local:') && authed) {
    try { await removeStorage({ path: existing.storageKey }) } catch (err) { console.warn('[documentsStore] storage delete failed', err) }
  }
  const modes: Array<'userPool' | 'apiKey'> = authed ? ['userPool', 'apiKey'] : ['apiKey']
  let deleted = false
  let lastErr = ''
  for (const mode of modes) {
    try {
      const client = dataClient(mode)
      const { errors } = await client.models.Document.delete({ id: documentId })
      if (!errors?.length) { deleted = true; break }
      lastErr = errors[0].message || `${mode} delete failed`
    } catch (err) { lastErr = err instanceof Error ? err.message : String(err) }
  }
  state.documents = state.documents.filter((d) => d.id !== documentId)
  emit()
  if (!deleted) {
    console.warn('[documentsStore] Document.delete not authorized or failed — removed locally only', lastErr)
  }
}
