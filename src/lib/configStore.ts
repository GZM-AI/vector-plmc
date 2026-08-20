/**
 * Phase 1 config store — cloud-first Registry spine
 * Load: Amplify → localStorage cache → seed
 * Save: localStorage + Amplify (verify when possible)
 */
import type {
  Baseline,
  ReleaseStatus,
  ResourceEntity,
  RevisionRecord,
  StructuralEntityType,
} from '../types/plm';
import { ALL_ENTITIES, TAR_TREE } from '../data/tarSeedData';
import { SEED_REVISION_HISTORY } from '../data/revisionSeed';
import { SEED_BASELINES } from '../data/baselinesSeed';
import { makeRevisionRecord, nextRevision, sortHistoryNewestFirst } from './revisionUtils';
import { getProductClient } from './productAmplify';

const STORAGE_KEY = 'vector-plm-config-v1';

export type EntityOverlay = {
  revision: string;
  status: ReleaseStatus;
  lastModified: string;
  modifiedBy?: string;
  name?: string;
  description?: string;
  notes?: string;
};

export type AddableChildType = Extract<
  StructuralEntityType,
  'Component' | 'SoftwareItem' | 'Interface' | 'Capability'
>;

type StoreState = {
  overlays: Record<string, EntityOverlay>;
  extraEntities: ResourceEntity[];
  extraHistory: RevisionRecord[];
  extraBaselines: Baseline[];
  cloudHydrated: boolean;
};

function emptyState(): StoreState {
  return {
    overlays: {},
    extraEntities: [],
    extraHistory: [],
    extraBaselines: [],
    cloudHydrated: false,
  };
}

function loadLocal(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      overlays: parsed.overlays || {},
      extraEntities: parsed.extraEntities || [],
      extraHistory: parsed.extraHistory || [],
      extraBaselines: parsed.extraBaselines || [],
      cloudHydrated: false,
    };
  } catch {
    return emptyState();
  }
}

function saveLocal(s: StoreState): void {
  try {
    const { cloudHydrated: _, ...rest } = s;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

let state: StoreState = loadLocal();
const listeners = new Set<() => void>();
let hydratePromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeConfigStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getConfigState(): StoreState {
  return state;
}

function hasErrors(result: { errors?: unknown[] } | null | undefined): boolean {
  return Array.isArray(result?.errors) && result!.errors!.length > 0;
}

// ─── Cloud I/O ───────────────────────────────────────────────────────────────

async function pullFromCloud(): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ProductOverlay) {
    console.warn('[configStore] cloud pull skipped — no client / models');
    return false;
  }
  try {
    const [ov, ex, rev, bl] = await Promise.all([
      client.models.ProductOverlay.list({ limit: 1000 }),
      client.models.ExtraEntity.list({ limit: 1000 }),
      client.models.RevisionEvent.list({ limit: 2000 }),
      client.models.BaselineRecord.list({ limit: 500 }),
    ]);

    if (hasErrors(ov) || hasErrors(ex) || hasErrors(rev) || hasErrors(bl)) {
      console.error('[configStore] cloud list errors', {
        ov: ov?.errors,
        ex: ex?.errors,
        rev: rev?.errors,
        bl: bl?.errors,
      });
      return false;
    }

    const overlays: Record<string, EntityOverlay> = {};
    for (const row of ov?.data || []) {
      if (!row?.entityId) continue;
      overlays[row.entityId] = {
        revision: row.revision || 'A',
        status: (row.status as ReleaseStatus) || 'Draft',
        lastModified: row.lastModified || new Date().toISOString(),
        modifiedBy: row.modifiedBy || undefined,
        name: row.name ?? undefined,
        description: row.description ?? undefined,
        notes: row.notes ?? undefined,
      };
    }

    const extraEntities: ResourceEntity[] = (ex?.data || []).map((row: any) => ({
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      type: row.type as StructuralEntityType,
      description: row.description || undefined,
      revision: row.revision || 'A',
      status: (row.status as ReleaseStatus) || 'Draft',
      modifiedBy: row.modifiedBy || undefined,
      lastModified: row.lastModified,
      createdAt: row.createdAt,
      children: [],
    }));

    const extraHistory: RevisionRecord[] = (rev?.data || []).map((row: any) => ({
      id: row.id,
      type: 'RevisionRecord' as const,
      entityId: row.entityId,
      revision: row.revision,
      status: row.status as ReleaseStatus,
      comment: row.comment || undefined,
      changesSummary: row.changesSummary || undefined,
      changedBy: row.changedBy || undefined,
      changedAt: row.changedAt,
    }));

    const extraBaselines: Baseline[] = (bl?.data || []).map((row: any) => ({
      id: row.id,
      type: 'Baseline' as const,
      name: row.name,
      description: row.description || undefined,
      status: (row.status as ReleaseStatus) || 'Draft',
      entityRevisions: JSON.parse(row.entityRevisionsJson || '{}'),
      createdBy: row.createdBy || undefined,
      createdAt: row.createdAt,
    }));

    state = {
      overlays,
      extraEntities,
      extraHistory,
      extraBaselines,
      cloudHydrated: true,
    };
    saveLocal(state);
    console.log('[configStore] hydrated from cloud', {
      overlays: Object.keys(overlays).length,
      extraEntities: extraEntities.length,
      history: extraHistory.length,
      baselines: extraBaselines.length,
    });
    notify();
    return true;
  } catch (err) {
    console.error('[configStore] cloud pull failed', err);
    return false;
  }
}

/** Call once after Amplify client is configured (e.g. from main.tsx or App). */
export function hydrateConfigStoreFromCloud(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = pullFromCloud().then(() => undefined);
  }
  return hydratePromise;
}

async function upsertOverlayCloud(entityId: string, o: EntityOverlay): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ProductOverlay) return false;
  const payload = {
    entityId,
    revision: o.revision,
    status: o.status,
    name: o.name,
    description: o.description,
    notes: o.notes,
    modifiedBy: o.modifiedBy,
    lastModified: o.lastModified,
  };
  try {
    let result = await client.models.ProductOverlay.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.ProductOverlay.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[configStore] overlay cloud write failed', result?.errors || result);
      return false;
    }
    console.log('[configStore] overlay cloud ok', entityId);
    return true;
  } catch (err) {
    console.error('[configStore] overlay cloud error', err);
    return false;
  }
}

async function upsertExtraEntityCloud(entity: ResourceEntity): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ExtraEntity) return false;
  const payload = {
    id: entity.id,
    parentId: entity.parentId || '',
    name: entity.name,
    type: entity.type,
    description: entity.description,
    revision: entity.revision,
    status: entity.status,
    modifiedBy: entity.modifiedBy,
    lastModified: entity.lastModified || new Date().toISOString(),
    createdAt: entity.createdAt || new Date().toISOString(),
  };
  try {
    let result = await client.models.ExtraEntity.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.ExtraEntity.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[configStore] extraEntity cloud write failed', result?.errors || result);
      return false;
    }
    console.log('[configStore] extraEntity cloud ok', entity.id);
    return true;
  } catch (err) {
    console.error('[configStore] extraEntity cloud error', err);
    return false;
  }
}

async function createRevisionEventCloud(record: RevisionRecord): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.RevisionEvent) return false;
  const payload = {
    id: record.id,
    entityId: record.entityId,
    revision: record.revision,
    status: record.status,
    comment: record.comment,
    changesSummary: record.changesSummary,
    changedBy: record.changedBy,
    changedAt: record.changedAt,
  };
  try {
    const result = await client.models.RevisionEvent.create(payload);
    if (hasErrors(result) || !result?.data) {
      console.error('[configStore] revisionEvent cloud write failed', result?.errors || result);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[configStore] revisionEvent cloud error', err);
    return false;
  }
}

async function createBaselineCloud(b: Baseline): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.BaselineRecord) return false;
  const payload = {
    id: b.id,
    name: b.name,
    description: b.description,
    status: b.status,
    entityRevisionsJson: JSON.stringify(b.entityRevisions || {}),
    createdBy: b.createdBy,
    createdAt: b.createdAt,
  };
  try {
    const result = await client.models.BaselineRecord.create(payload);
    if (hasErrors(result) || !result?.data) {
      console.error('[configStore] baseline cloud write failed', result?.errors || result);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[configStore] baseline cloud error', err);
    return false;
  }
}

/**
 * Push entire local state to cloud (one-time migration from a browser that has data).
 */
export async function uploadLocalConfigToCloud(): Promise<{ ok: boolean; message: string }> {
  const client = getProductClient();
  if (!client?.models?.ProductOverlay) {
    return { ok: false, message: 'Amplify client not configured' };
  }
  let ok = 0;
  let fail = 0;
  for (const [id, o] of Object.entries(state.overlays)) {
    (await upsertOverlayCloud(id, o)) ? ok++ : fail++;
  }
  for (const e of state.extraEntities) {
    (await upsertExtraEntityCloud(e)) ? ok++ : fail++;
  }
  for (const r of state.extraHistory) {
    (await createRevisionEventCloud(r)) ? ok++ : fail++;
  }
  for (const b of state.extraBaselines) {
    (await createBaselineCloud(b)) ? ok++ : fail++;
  }
  await pullFromCloud();
  return {
    ok: fail === 0,
    message: `Uploaded ${ok} records` + (fail ? `, ${fail} failed` : ''),
  };
}

// ─── Local merge API (same surface as before) ────────────────────────────────

export function applyOverlay(entity: ResourceEntity): ResourceEntity {
  const o = state.overlays[entity.id];
  if (!o) return entity;
  return {
    ...entity,
    revision: o.revision ?? entity.revision,
    status: o.status ?? entity.status,
    lastModified: o.lastModified ?? entity.lastModified,
    modifiedBy: o.modifiedBy ?? entity.modifiedBy,
    name: o.name !== undefined ? o.name : entity.name,
    description: o.description !== undefined ? o.description : entity.description,
    ...(o.notes !== undefined ? { notes: o.notes } : {}),
  } as ResourceEntity & { notes?: string };
}

export function getMergedAllEntities(): ResourceEntity[] {
  const seedIds = new Set(ALL_ENTITIES.map((e) => e.id));
  const extras = state.extraEntities.filter((e) => !seedIds.has(e.id));
  return [...ALL_ENTITIES, ...extras].map((e) => applyOverlay(e));
}

export function getRegistryTree(): ResourceEntity {
  const inject = (node: ResourceEntity): ResourceEntity => {
    const base = applyOverlay(node);
    const seedChildren = (node.children || []).map(inject);
    const extrasHere = state.extraEntities
      .filter((e) => e.parentId === node.id)
      .map((e) => inject(e));
    const seen = new Set(seedChildren.map((c) => c.id));
    const children = [...seedChildren, ...extrasHere.filter((c) => !seen.has(c.id))];
    return { ...base, children };
  };
  return inject(TAR_TREE);
}

export function getEntityById(id: string): ResourceEntity | undefined {
  return getMergedAllEntities().find((e) => e.id === id);
}

export function getAllEntitiesWithOverlays(): ResourceEntity[] {
  return getMergedAllEntities();
}

export function getHistoryForEntity(entityId: string): RevisionRecord[] {
  return sortHistoryNewestFirst(
    [...SEED_REVISION_HISTORY, ...state.extraHistory].filter((r) => r.entityId === entityId)
  );
}

export function getAllBaselines(): Baseline[] {
  return [...SEED_BASELINES, ...state.extraBaselines].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'item'
  );
}

export function addChildEntity(
  parentId: string,
  input: {
    name: string;
    type: AddableChildType;
    description?: string;
    createdBy?: string;
  }
): ResourceEntity | null {
  const parent = getEntityById(parentId) || ALL_ENTITIES.find((e) => e.id === parentId);
  if (!parent) return null;
  if (parent.type !== 'System' && parent.type !== 'Subsystem') return null;

  const name = input.name.trim();
  if (!name) return null;

  const now = new Date().toISOString();
  const by = input.createdBy ?? 'Zedekiah';
  const id = `user-${parentId}-${slugify(name)}-${Date.now().toString(36)}`;

  const entity: ResourceEntity = {
    id,
    name,
    type: input.type,
    description: input.description?.trim() || undefined,
    parentId,
    revision: 'A',
    status: 'Draft',
    createdAt: now,
    lastModified: now,
    modifiedBy: by,
    children: [],
  };

  state = {
    ...state,
    extraEntities: [...state.extraEntities, entity],
  };
  saveLocal(state);
  notify();
  void upsertExtraEntityCloud(entity);
  return applyOverlay(entity);
}

export function updateEntityFields(
  entityId: string,
  fields: {
    name?: string;
    description?: string;
    notes?: string;
    modifiedBy?: string;
  }
): ResourceEntity | null {
  const current = getEntityById(entityId);
  if (!current) return null;

  const prev = state.overlays[entityId];
  const now = new Date().toISOString();
  const by = fields.modifiedBy ?? 'Zedekiah';

  if (state.extraEntities.some((e) => e.id === entityId)) {
    state = {
      ...state,
      extraEntities: state.extraEntities.map((e) =>
        e.id === entityId
          ? {
              ...e,
              name: fields.name !== undefined ? fields.name : e.name,
              description:
                fields.description !== undefined ? fields.description : e.description,
              lastModified: now,
              modifiedBy: by,
            }
          : e
      ),
    };
    const updatedExtra = state.extraEntities.find((e) => e.id === entityId);
    if (updatedExtra) void upsertExtraEntityCloud(updatedExtra);
  }

  const nextOverlay: EntityOverlay = {
    revision: prev?.revision ?? current.revision,
    status: prev?.status ?? current.status,
    lastModified: now,
    modifiedBy: by,
    name: fields.name !== undefined ? fields.name : prev?.name,
    description: fields.description !== undefined ? fields.description : prev?.description,
    notes: fields.notes !== undefined ? fields.notes : prev?.notes,
  };
  if (fields.name !== undefined) nextOverlay.name = fields.name;
  if (fields.description !== undefined) nextOverlay.description = fields.description;
  if (fields.notes !== undefined) nextOverlay.notes = fields.notes;

  state = {
    ...state,
    overlays: { ...state.overlays, [entityId]: nextOverlay },
  };
  saveLocal(state);
  notify();
  void upsertOverlayCloud(entityId, nextOverlay);
  return getEntityById(entityId) || null;
}

export function bumpEntityRevision(
  entityId: string,
  opts?: {
    comment?: string;
    status?: ReleaseStatus;
    changedBy?: string;
    changesSummary?: string;
  }
): { entity: ResourceEntity; record: RevisionRecord } | null {
  const current = getEntityById(entityId);
  if (!current) return null;

  const prev = state.overlays[entityId];
  const newRev = nextRevision(current.revision);
  const newStatus: ReleaseStatus = opts?.status ?? 'Draft';
  const now = new Date().toISOString();
  const by = opts?.changedBy ?? 'Zedekiah';

  const record = makeRevisionRecord({
    entityId,
    revision: newRev,
    status: newStatus,
    changedBy: by,
    comment: opts?.comment,
    changesSummary: opts?.changesSummary,
  });

  if (state.extraEntities.some((e) => e.id === entityId)) {
    state = {
      ...state,
      extraEntities: state.extraEntities.map((e) =>
        e.id === entityId
          ? { ...e, revision: newRev, status: newStatus, lastModified: now, modifiedBy: by }
          : e
      ),
    };
    const updatedExtra = state.extraEntities.find((e) => e.id === entityId);
    if (updatedExtra) void upsertExtraEntityCloud(updatedExtra);
  }

  const nextOverlay: EntityOverlay = {
    revision: newRev,
    status: newStatus,
    lastModified: now,
    modifiedBy: by,
    name: prev?.name,
    description: prev?.description,
    notes: prev?.notes,
  };

  state = {
    ...state,
    overlays: { ...state.overlays, [entityId]: nextOverlay },
    extraHistory: [...state.extraHistory, record],
  };
  saveLocal(state);
  notify();
  void upsertOverlayCloud(entityId, nextOverlay);
  void createRevisionEventCloud(record);

  const entity = getEntityById(entityId);
  if (!entity) return null;
  return { entity, record };
}

export function createBaseline(input: {
  name: string;
  description?: string;
  status?: ReleaseStatus;
  createdBy?: string;
  entityIds?: string[];
}): Baseline {
  const entities = getAllEntitiesWithOverlays();
  const ids = input.entityIds ? new Set(input.entityIds) : null;
  const entityRevisions: Record<string, string> = {};
  for (const e of entities) {
    if (!ids || ids.has(e.id)) entityRevisions[e.id] = e.revision;
  }

  const baseline: Baseline = {
    id: `bl-${Date.now()}`,
    type: 'Baseline',
    name: input.name,
    description: input.description,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? 'Zedekiah',
    status: input.status ?? 'Draft',
    entityRevisions,
  };

  state = {
    ...state,
    extraBaselines: [...state.extraBaselines, baseline],
  };
  saveLocal(state);
  notify();
  void createBaselineCloud(baseline);
  return baseline;
}

export function compareEntityRevisions(
  entityId: string,
  revA: string,
  revB: string
): { a?: RevisionRecord; b?: RevisionRecord } {
  const hist = getHistoryForEntity(entityId);
  return {
    a: hist.find((r) => r.revision === revA),
    b: hist.find((r) => r.revision === revB),
  };
}

export function resetConfigStore(): void {
  state = emptyState();
  saveLocal(state);
  notify();
}

export function isConfigCloudHydrated(): boolean {
  return state.cloudHydrated;
}
