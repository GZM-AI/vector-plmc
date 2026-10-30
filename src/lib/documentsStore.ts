/**
 * Documents / attachments — team-shared (cloud-first, cloud-only for new files)
 *
 * Bytes:  Amplify Storage  documents/{documentId}/{fileName}
 * Meta:   Amplify Data Document (userPool only — no API key)
 * Cache:  localStorage vector-plm-documents-v1 (list only)
 *
 * New attachments require a signed-in user and are written only to Amplify Storage
 * + Document. Older local: records (if any) still open from the browser cache.
 * Multiple files per entity are supported via linkedEntityIds.
 */
import { generateClient } from 'aws-amplify/data'
import { getCurrentUser } from 'aws-amplify/auth'
import { uploadData, getUrl, remove as removeStorage } from 'aws-amplify/storage'
import type { Schema } from '../../amplify/data/resource'
import type { Document, DocumentKind, ReleaseStatus } from '../types/plm'

const CACHE_KEY = 'vector-plm-documents-v1'
const BYTES_KEY = 'vector-plm-doc-bytes-v1'
const ATTACH_KEY = 'vector-attachments-v1'
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

function isDocsAuthError(msg: string): boolean {
  return /unauthorized|not authorized|unauthenticated|No current user|UserUnAuthenticated/i.test(msg)
}

type AttachmentIndex = {
  documents: Document[]
  hiddenIds: string[]
}

async function loadAttachmentIndex(): Promise<AttachmentIndex> {
  const client = dataClient('apiKey')
  const { data, errors } = await client.models.MapLayout.get({ layoutKey: ATTACH_KEY })
  if (errors?.length || !data?.hotspotsJson) return { documents: [], hiddenIds: [] }
  try {
    const parsed = JSON.parse(String(data.hotspotsJson)) as Partial<AttachmentIndex>
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      hiddenIds: Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [],
    }
  } catch {
    return { documents: [], hiddenIds: [] }
  }
}

async function saveAttachmentIndex(index: AttachmentIndex): Promise<void> {
  const client = dataClient('apiKey')
  const payload = {
    layoutKey: ATTACH_KEY,
    hotspotsJson: JSON.stringify(index),
    updatedBy: await currentUserLabel(),
  }
  let result = await client.models.MapLayout.update(payload)
  if (result.errors?.length) {
    result = await client.models.MapLayout.create(payload)
  }
  if (result.errors?.length) {
    throw new Error(result.errors[0].message || 'Could not save attachment index')
  }
}

export async function hydrateDocumentsStoreFromCloud(): Promise<void> {
  try {
    const index = await loadAttachmentIndex()
    const hidden = new Set(index.hiddenIds)
    const byId = new Map<string, Document>()
    for (const doc of index.documents) {
      if (doc?.id && !hidden.has(doc.id)) byId.set(doc.id, doc)
    }

    const modes: Array<'apiKey' | 'userPool'> = ['apiKey', 'userPool']
    for (const mode of modes) {
      try {
        const client = dataClient(mode)
        const { data, errors } = await client.models.Document.list({ limit: 1000 })
        if (errors?.length) {
          if (isDocsAuthError(errors[0].message || '')) continue
          break
        }
        for (const row of data || []) {
          const doc = fromRow(row as unknown as Record<string, unknown>)
          if (doc && !hidden.has(doc.id)) byId.set(doc.id, doc)
        }
        break
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (isDocsAuthError(msg)) continue
        break
      }
    }

    for (const local of state.documents) {
      if (!hidden.has(local.id) && !byId.has(local.id)) byId.set(local.id, local)
    }
    state.documents = [...byId.values()]
    state.hydrated = true
    state.lastError = null
    emit()
    console.log('[documentsStore] hydrated', state.documents.length)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    state.lastError = isDocsAuthError(msg) ? null : msg
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

  const authed = await signedIn()
  if (!authed) {
    throw new Error('Sign in first — attachments are stored in the team cloud, not on this device.')
  }

  const id = `doc-${crypto.randomUUID()}`
  const fileName = safeFileName(file.name)
  const storageKey = `documents/${id}/${fileName}`
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  const kind = opts?.kind || inferKind(file)
  const name = (opts?.name || file.name.replace(/\.[^.]+$/, '') || file.name).trim()
  const contentType = file.type || 'application/octet-stream'

  try {
    await uploadData({
      path: storageKey,
      data: file,
      options: { contentType },
    }).result
  } catch (pathErr) {
    try {
      await (uploadData as (input: Record<string, unknown>) => { result: Promise<unknown> })({
        key: storageKey,
        data: file,
        options: { contentType },
      }).result
    } catch {
      console.warn('[documentsStore] storage upload failed', pathErr)
      throw new Error('Cloud upload failed. Check your connection and Amplify Storage access.')
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

  const modes: Array<'userPool' | 'apiKey'> = ['userPool', 'apiKey']
  for (const mode of modes) {
    try {
      const client = dataClient(mode)
      const { errors } = await client.models.Document.create(payload)
      if (!errors?.length) break
    } catch {
      /* Document model is still private on the live API */
    }
  }

  const index = await loadAttachmentIndex()
  index.documents = [record, ...index.documents.filter((d) => d.id !== id)]
  index.hiddenIds = index.hiddenIds.filter((hid) => hid !== id)
  await saveAttachmentIndex(index)

  state.documents = [record, ...state.documents.filter((d) => d.id !== id)]
  state.lastError = null
  emit()
  return record
}

export async function attachDocumentsToEntity(
  entityId: string,
  files: File[],
  opts?: { kind?: DocumentKind; description?: string }
): Promise<Document[]> {
  const results: Document[] = []
  const errors: string[] = []
  for (const file of files) {
    try {
      results.push(await attachDocumentToEntity(entityId, file, opts))
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  if (errors.length && results.length === 0) {
    throw new Error(errors.join(' · '))
  }
  if (errors.length) {
    state.lastError = errors.join(' · ')
    emit()
  }
  return results
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

export type PreviewBlock = {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'blank'
  text: string
}

export type DocumentPreview = {
  title: string
  fileName?: string
  kind: 'article' | 'text' | 'image' | 'pdf' | 'file'
  text?: string
  blocks?: PreviewBlock[]
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

function paragraphPlain(xmlChunk: string): string {
  const withBreaks = xmlChunk
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
  const parts = [...withBreaks.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((m) =>
    decodeXmlEntities(m[1])
  )
  return parts.join('')
}

function lineToBlock(line: string, style?: string): PreviewBlock {
  const raw = line.replace(/\s+$/, '')
  if (!raw.trim()) return { type: 'blank', text: '' }
  if (style === 'Heading1' || /^#\s+/.test(raw))
    return { type: 'h1', text: raw.replace(/^#\s+/, '') }
  if (style === 'Heading2' || /^##\s+/.test(raw))
    return { type: 'h2', text: raw.replace(/^##\s+/, '') }
  if (style === 'Heading3' || /^###\s+/.test(raw))
    return { type: 'h3', text: raw.replace(/^###\s+/, '') }
  if (/^\s*([-*•]|\d+\.)\s+/.test(raw))
    return { type: 'li', text: raw.replace(/^\s*([-*•]|\d+\.)\s+/, '') }
  return { type: 'p', text: raw }
}

function docxXmlToBlocks(xml: string): PreviewBlock[] {
  const chunks = xml.split(/<\/w:p>/)
  const blocks: PreviewBlock[] = []
  for (const chunk of chunks) {
    if (!/<w:t\b/.test(chunk) && !/<w:p[ >]/.test(chunk) && !chunk.includes('<w:p')) {
      continue
    }
    const style = /w:pStyle[^>]*w:val="([^"]+)"/.exec(chunk)?.[1]
    const text = paragraphPlain(chunk)
    if (!text && !style) {
      if (blocks.length && blocks[blocks.length - 1].type !== 'blank') {
        blocks.push({ type: 'blank', text: '' })
      }
      continue
    }
    if (text.includes('\n')) {
      text.split('\n').forEach((line) => blocks.push(lineToBlock(line, style)))
    } else {
      blocks.push(lineToBlock(text, style))
    }
  }
  while (blocks.length && blocks[0].type === 'blank') blocks.shift()
  while (blocks.length && blocks[blocks.length - 1].type === 'blank') blocks.pop()
  return blocks
}

function textToBlocks(text: string): PreviewBlock[] {
  return text.split(/\r?\n/).map((line) => lineToBlock(line))
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
      const blocks = docxXmlToBlocks(xml)
      return {
        title,
        fileName: doc.fileName,
        kind: 'article',
        blocks,
        text: blocks.map((b) => (b.type === 'blank' ? '' : b.text)).join('\n'),
      }
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
    const raw = new TextDecoder().decode(bytes)
    return {
      title,
      fileName: doc.fileName,
      kind: 'article',
      blocks: textToBlocks(raw),
      text: raw,
    }
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

async function mutateDocument(
  run: (mode: 'apiKey' | 'userPool') => Promise<{ errors?: { message?: string }[] | null }>
): Promise<void> {
  const modes: Array<'apiKey' | 'userPool'> = ['apiKey', 'userPool']
  let last = 'Delete failed'
  for (const mode of modes) {
    try {
      const { errors } = await run(mode)
      if (!errors?.length) return
      last = errors[0].message || last
      if (!isDocsAuthError(last)) break
    } catch (err) {
      last = err instanceof Error ? err.message : String(err)
      if (!isDocsAuthError(last)) break
    }
  }
  throw new Error(
    isDocsAuthError(last)
      ? 'The Document API rejected this delete. You are signed in, but AppSync still has Document as authenticated-only and is not accepting this session. A backend deploy is required.'
      : last
  )
}

export async function unlinkDocumentFromEntity(documentId: string, entityId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  if (!existing) return
  const linked = existing.linkedEntityIds.filter((id) => id !== entityId)
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  await mutateDocument((mode) =>
    dataClient(mode).models.Document.update({
      id: documentId,
      linkedEntityIdsJson: JSON.stringify(linked),
      lastModified: now,
      modifiedBy,
    })
  )
  state.documents = state.documents.map((d) =>
    d.id === documentId ? { ...d, linkedEntityIds: linked, lastModified: now, modifiedBy } : d
  )
  emit()
}

export async function deleteDocument(documentId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  if (existing?.storageKey && !existing.storageKey.startsWith('local:')) {
    try {
      await removeStorage({ path: existing.storageKey })
    } catch (err) {
      console.warn('[documentsStore] storage delete failed', err)
    }
  }
  try {
    await mutateDocument((mode) => dataClient(mode).models.Document.delete({ id: documentId }))
  } catch (err) {
    console.warn('[documentsStore] Document.delete skipped', err)
  }
  const index = await loadAttachmentIndex()
  index.documents = index.documents.filter((d) => d.id !== documentId)
  if (!index.hiddenIds.includes(documentId)) index.hiddenIds.push(documentId)
  await saveAttachmentIndex(index)
  state.documents = state.documents.filter((d) => d.id !== documentId)
  state.lastError = null
  emit()
}
