/**
 * Deep Research saved runs — cloud-first
 * Amplify ResearchRecord + localStorage cache vector-plm-research-v1
 *
 * Until ResearchRecord is in the deployed AppSync schema, saves stay on this
 * browser and retry to cloud on hydrate.
 */
import { generateClient } from 'aws-amplify/data'
import { getCurrentUser } from 'aws-amplify/auth'
import type { Schema } from '../../amplify/data/resource'
import { getProductClient } from './productAmplify'

export type ResearchKindId = 'company' | 'product' | 'cost' | 'manufacturing' | 'open'
export type ResearchProviderId = 'grok' | 'claude'

export type ResearchRun = {
  id: string
  title: string
  query: string
  resultText: string
  kind: string
  kindId: ResearchKindId
  provider: ResearchProviderId
  modelId: string
  modelLabel: string
  entityId?: string
  entityName?: string
  entityType?: string
  createdAt: string
  createdBy?: string
  status: 'Kept'
}

type StoreState = {
  runs: ResearchRun[]
  hydrated: boolean
  lastError: string | null
}

const CACHE_KEY = 'vector-plm-research-v1'
const MAX_RESULT = 80_000

const listeners = new Set<() => void>()

function loadCache(): StoreState {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return { runs: [], hydrated: false, lastError: null }
    const parsed = JSON.parse(raw) as { runs?: ResearchRun[] }
    return {
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
      hydrated: false,
      lastError: null,
    }
  } catch {
    return { runs: [], hydrated: false, lastError: null }
  }
}

let state: StoreState = loadCache()

function persist() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ runs: state.runs }))
  } catch {
    /* quota */
  }
}

function emit() {
  persist()
  listeners.forEach((fn) => fn())
}

export function subscribeResearchStore(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getResearchRuns(): ResearchRun[] {
  return [...state.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getResearchStoreError(): string | null {
  return state.lastError
}

function dataClient() {
  try {
    return generateClient<Schema>({ authMode: 'apiKey' }) as any
  } catch {
    return getProductClient()
  }
}

function researchModel(client: any) {
  return client?.models?.ResearchRecord || null
}

function fromRow(row: Record<string, unknown>): ResearchRun | null {
  if (!row?.id || !row?.query) return null
  return {
    id: String(row.id),
    title: String(row.title || row.query).slice(0, 160),
    query: String(row.query),
    resultText: String(row.resultText || ''),
    kind: String(row.kind || 'Open'),
    kindId: (String(row.kindId || 'open') as ResearchKindId) || 'open',
    provider: (String(row.provider || 'grok') as ResearchProviderId) || 'grok',
    modelId: String(row.modelId || ''),
    modelLabel: String(row.modelLabel || row.modelId || ''),
    entityId: row.entityId ? String(row.entityId) : undefined,
    entityName: row.entityName ? String(row.entityName) : undefined,
    entityType: row.entityType ? String(row.entityType) : undefined,
    createdAt: String(row.createdAt || new Date().toISOString()),
    createdBy: row.createdBy ? String(row.createdBy) : undefined,
    status: 'Kept',
  }
}

async function currentUserLabel(): Promise<string> {
  try {
    const u = await getCurrentUser()
    return u.signInDetails?.loginId || u.username || 'user'
  } catch {
    return 'user'
  }
}

async function upsertCloud(run: ResearchRun): Promise<boolean> {
  const client = dataClient()
  const model = researchModel(client)
  if (!model) return false
  const payload = {
    id: run.id,
    title: run.title,
    query: run.query,
    resultText: run.resultText.slice(0, MAX_RESULT),
    kind: run.kind,
    kindId: run.kindId,
    provider: run.provider,
    modelId: run.modelId,
    modelLabel: run.modelLabel,
    entityId: run.entityId,
    entityName: run.entityName,
    entityType: run.entityType,
    createdAt: run.createdAt,
    createdBy: run.createdBy,
    status: run.status,
  }
  try {
    let result = await model.update(payload)
    if (result?.errors?.length || !result?.data) {
      result = await model.create(payload)
    }
    if (result?.errors?.length) {
      console.error('[researchStore] cloud write failed', result.errors)
      return false
    }
    return true
  } catch (err) {
    console.error('[researchStore] cloud write error', err)
    return false
  }
}

export async function hydrateResearchStoreFromCloud(): Promise<void> {
  const client = dataClient()
  const model = researchModel(client)
  if (!model) {
    state.lastError = null
    state.hydrated = true
    emit()
    console.warn('[researchStore] ResearchRecord model missing — local cache only')
    return
  }
  try {
    const { data, errors } = await model.list({ limit: 500 })
    if (errors?.length) {
      state.lastError = errors[0].message || 'Research list failed'
      emit()
      return
    }
    const cloud = (data || [])
      .map((row: any) => fromRow(row as Record<string, unknown>))
      .filter((r: ResearchRun | null): r is ResearchRun => !!r)

    if (cloud.length === 0 && state.runs.length > 0) {
      for (const run of state.runs) await upsertCloud(run)
      state.hydrated = true
      state.lastError = null
      emit()
      return
    }

    const byId = new Map<string, ResearchRun>()
    for (const r of [...state.runs, ...cloud]) byId.set(r.id, r)
    state.runs = [...byId.values()]
    state.hydrated = true
    state.lastError = null
    emit()
    console.log('[researchStore] hydrated', state.runs.length)
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err)
    console.warn('[researchStore] hydrate failed — using local cache', err)
    emit()
  }
}

export async function saveResearchRun(input: {
  title?: string
  query: string
  resultText: string
  kind: string
  kindId: ResearchKindId
  provider: ResearchProviderId
  modelId: string
  modelLabel: string
  entityId?: string
  entityName?: string
  entityType?: string
}): Promise<ResearchRun> {
  const createdBy = await currentUserLabel()
  const title =
    (input.title || input.query).replace(/\s+/g, ' ').trim().slice(0, 160) || 'Untitled run'
  const run: ResearchRun = {
    id: `rs-${crypto.randomUUID()}`,
    title,
    query: input.query,
    resultText: input.resultText.slice(0, MAX_RESULT),
    kind: input.kind,
    kindId: input.kindId,
    provider: input.provider,
    modelId: input.modelId,
    modelLabel: input.modelLabel,
    entityId: input.entityId,
    entityName: input.entityName,
    entityType: input.entityType,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'Kept',
  }
  state.runs = [run, ...state.runs.filter((r) => r.id !== run.id)]
  state.lastError = null
  emit()
  const ok = await upsertCloud(run)
  if (!ok) {
    state.lastError = 'Saved on this device. Cloud model not deployed yet.'
    emit()
  }
  return run
}

export async function deleteResearchRun(id: string): Promise<void> {
  state.runs = state.runs.filter((r) => r.id !== id)
  emit()
  const client = dataClient()
  const model = researchModel(client)
  if (!model) return
  try {
    await model.delete({ id })
  } catch (err) {
    console.warn('[researchStore] cloud delete failed', err)
  }
}
