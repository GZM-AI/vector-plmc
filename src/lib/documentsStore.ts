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
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'file'
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

export async function hydrateDocumentsStoreFromCloud(): Promise<void> {
  try {
    const mode = (await signedIn()) ? 'userPool' : 'apiKey'
    const client = dataClient(mode)
    const { data, errors } = await client.models.Document.list({ limit: 1000 })
    if (errors?.length) {
      state.lastError = errors[0].message || 'Document list failed'
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    state.lastError = msg
    console.warn('[documentsStore] hydrate failed — using local cache', err)
    emit()
  }
}

export async function attachDocumentToEntity(
  entityId: string,
  file: File,
  opts?: { name?: string; kind?: DocumentKind; description?: string }
): Promise<Document> {
  if (!file || !file.size) throw new Error('Choose a file to attach.')
  if (file.size > MAX_BYTES) {
    throw new Error(`File is too large (${Math.round(file.size / 1048576)} MB). Max is 80 MB.`)
  }

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
      await uploadData({
        path: storageKey,
        data: file,
        options: { contentType },
      }).result
      cloudFile = true
    } catch (pathErr) {
      try {
        await (uploadData as (input: Record<string, unknown>) => { result: Promise<unknown> })({
          key: storageKey,
          data: file,
          options: { contentType },
        }).result
        cloudFile = true
      } catch {
        console.warn('[documentsStore] storage upload failed', pathErr)
      }
    }
  }

  if (!cloudFile) {
    storageKey = `local:${id}`
    try {
      await saveLocalBytes(id, file)
    } catch (e) {
      console.warn('[documentsStore] local byte cache failed', e)
    }
  }

  const record: Document = {
    id,
    name,
    type: 'Document',
    kind,
    description: opts?.description,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
    storageKey,
    fileName,
    revision: 'A',
    status: 'Draft',
    classification: 'CUI',
    linkedEntityIds: [entityId],
    createdAt: now,
    lastModified: now,
    modifiedBy,
  }

  const payload = {
    id: record.id,
    name: record.name,
    kind: record.kind,
    description: record.description,
    mimeType: record.mimeType,
    sizeBytes: record.sizeBytes,
    storageKey: record.storageKey,
    fileName: record.fileName,
    revision: record.revision,
    status: record.status,
    classification: record.classification,
    linkedEntityIdsJson: JSON.stringify(record.linkedEntityIds),
    createdAt: now,
    lastModified: now,
    modifiedBy,
  }

  const modes: Array<'userPool' | 'apiKey'> = authed ? ['userPool', 'apiKey'] : ['apiKey']
  let savedCloud = false
  let lastMetaErr = ''
  for (const mode of modes) {
    try {
      const client = dataClient(mode)
      const { errors } = await client.models.Document.create(payload)
      if (!errors?.length) {
        savedCloud = true
        break
      }
      lastMetaErr = errors[0].message || `${mode} create failed`
    } catch (err) {
      lastMetaErr = err instanceof Error ? err.message : String(err)
    }
  }

  state.documents = [record, ...state.documents.filter((d) => d.id !== id)]
  state.lastError = savedCloud
    ? null
    : lastMetaErr
      ? `Saved on this browser. Cloud: ${lastMetaErr}`
      : authed
        ? null
        : 'Saved on this browser. Sign in to push attachments to team Storage.'
  emit()
  return record
}

function dataUrlToBlobUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : 'data:application/octet-stream;base64'
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream'
  const binary = atob(payload)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

export type DocumentPreview = {
  title: string
  fileName?: string
  kind: 'text' | 'image' | 'pdf' | 'file'
  text?: string
  objectUrl?: string
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function zipStoreRead(buf: Uint8Array, wantPath: string): string | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const dec = new TextDecoder('utf-8')
  let offset = 0
  while (offset + 30 <= buf.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break
    const method = view.getUint16(offset + 8, true)
    const comp = view.getUint32(offset + 18, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)
    const name = dec.decode(buf.subarray(offset + 30, offset + 30 + nameLen))
    const dataStart = offset + 30 + nameLen + extraLen
    const data = buf.subarray(dataStart, dataStart + comp)
    if (name === wantPath) {
      if (method !== 0) return null
      return dec.decode(data)
    }
    offset = dataStart + comp
  }
  return null
}

function docxXmlToText(xml: string): string {
  const withBreaks = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
  const texts = [...withBreaks.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((m) =>
    decodeXmlEntities(m[1])
  )
  return texts.join('').replace(/\n{3,}/g, '\n\n').trim()
}

async function urlToBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith('data:')) {
    const comma = url.indexOf(',')
    const payload = comma >= 0 ? url.slice(comma + 1) : url
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load file (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function previewAttachedDocument(doc: Document): Promise<DocumentPreview> {
  const url = await getDocumentDownloadUrl(doc)
  const name = (doc.fileName || doc.name || '').toLowerCase()
  const mime = (doc.mimeType || '').toLowerCase()
  const title = doc.name || doc.fileName || 'Attachment'

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tif|tiff)$/.test(name)) {
    const objectUrl = url.startsWith('data:') ? dataUrlToBlobUrl(url) : url
    return { title, fileName: doc.fileName, kind: 'image', objectUrl }
  }
  if (mime.includes('pdf') || name.endsWith('.pdf')) {
    const objectUrl = url.startsWith('data:') ? dataUrlToBlobUrl(url) : url
    return { title, fileName: doc.fileName, kind: 'pdf', objectUrl }
  }
  if (
    mime.includes('word') ||
    mime.includes('officedocument') ||
    name.endsWith('.docx')
  ) {
    const bytes = await urlToBytes(url)
    const xml = zipStoreRead(bytes, 'word/document.xml')
    if (xml) {
      return { title, fileName: doc.fileName, kind: 'text', text: docxXmlToText(xml) }
    }
    return {
      title,
      fileName: doc.fileName,
      kind: 'file',
      text: 'This Word file cannot be previewed here. Use Download.',
    }
  }
  if (mime.startsWith('text/') || /\.(md|txt|csv|json)$/.test(name)) {
    const bytes = await urlToBytes(url)
    return { title, fileName: doc.fileName, kind: 'text', text: new TextDecoder().decode(bytes) }
  }
  return {
    title,
    fileName: doc.fileName,
    kind: 'file',
    text: 'No in-app preview for this file type. Use Download.',
  }
}

export async function openAttachedDocument(doc: Document): Promise<void> {
  const url = await getDocumentDownloadUrl(doc)
  const name = doc.fileName || `${doc.name || 'attachment'}.docx`
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    const href = url.startsWith('data:') ? dataUrlToBlobUrl(url) : url
    const a = document.createElement('a')
    a.href = href
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 2000)
    return
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.target = '_blank'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
}

export async function getDocumentDownloadUrl(doc: Document): Promise<string> {
  if (!doc.storageKey) throw new Error('This document has no file in storage.')
  if (doc.storageKey.startsWith('local:')) {
    const id = doc.storageKey.slice('local:'.length) || doc.id
    const dataUrl = localBytesUrl(id) || localBytesUrl(doc.id)
    if (!dataUrl) throw new Error('File is only on the machine that attached it.')
    return dataUrl
  }
  try {
    const { url } = await getUrl({
      path: doc.storageKey,
      options: { expiresIn: 300 },
    })
    return url.toString()
  } catch {
    const { url } = await getUrl({
      path: doc.storageKey,
      options: { expiresIn: 300 },
    } as never)
    return url.toString()
  }
}

export async function unlinkDocumentFromEntity(documentId: string, entityId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  if (!existing) return
  const linked = existing.linkedEntityIds.filter((id) => id !== entityId)
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  const mode = (await signedIn()) ? 'userPool' : 'apiKey'
  const client = dataClient(mode)
  const { errors } = await client.models.Document.update({
    id: documentId,
    linkedEntityIdsJson: JSON.stringify(linked),
    lastModified: now,
    modifiedBy,
  })
  if (errors?.length) throw new Error(errors[0].message || 'Unlink failed')
  state.documents = state.documents.map((d) =>
    d.id === documentId ? { ...d, linkedEntityIds: linked, lastModified: now, modifiedBy } : d
  )
  emit()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  const client = dataClient()
  if (existing?.storageKey) {
    try {
      await removeStorage({ path: existing.storageKey })
    } catch (err) {
      console.warn('[documentsStore] storage delete failed', err)
    }
  }
  const { errors } = await client.models.Document.delete({ id: documentId })
  if (errors?.length) throw new Error(errors[0].message || 'Delete failed')
  state.documents = state.documents.filter((d) => d.id !== documentId)
  emit()
}
