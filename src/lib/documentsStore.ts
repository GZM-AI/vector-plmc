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
const MAX_BYTES = 80 * 1024 * 1024

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

function dataClient() {
  return generateClient<Schema>({ authMode: 'userPool' })
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
    const client = dataClient()
    const { data, errors } = await client.models.Document.list({ limit: 1000 })
    if (errors?.length) {
      state.lastError = errors[0].message || 'Document list failed'
      emit()
      return
    }
    const docs = (data || [])
      .map((row) => fromRow(row as unknown as Record<string, unknown>))
      .filter((d): d is Document => !!d)
    state.documents = docs
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
  const storageKey = `documents/${id}/${fileName}`
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  const kind = opts?.kind || inferKind(file)
  const name = (opts?.name || file.name.replace(/\.[^.]+$/, '') || file.name).trim()

  await uploadData({
    path: storageKey,
    data: file,
    options: { contentType: file.type || 'application/octet-stream' },
  }).result

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

  const client = dataClient()
  const { errors } = await client.models.Document.create({
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
  })
  if (errors?.length) {
    try {
      await removeStorage({ path: storageKey })
    } catch {
      /* best effort */
    }
    throw new Error(errors[0].message || 'Document metadata save failed')
  }

  state.documents = [record, ...state.documents.filter((d) => d.id !== id)]
  state.lastError = null
  emit()
  return record
}

export async function getDocumentDownloadUrl(doc: Document): Promise<string> {
  if (!doc.storageKey) throw new Error('This document has no file in storage.')
  const { url } = await getUrl({
    path: doc.storageKey,
    options: { expiresIn: 300 },
  })
  return url.toString()
}

export async function unlinkDocumentFromEntity(documentId: string, entityId: string): Promise<void> {
  const existing = state.documents.find((d) => d.id === documentId)
  if (!existing) return
  const linked = existing.linkedEntityIds.filter((id) => id !== entityId)
  const now = new Date().toISOString()
  const modifiedBy = await currentUserLabel()
  const client = dataClient()
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
