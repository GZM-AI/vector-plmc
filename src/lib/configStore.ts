/**
 * Phase 1 — Client configuration store
 * Persists revision overlays, field edits (name/description/notes), history,
 * and baselines in localStorage until Amplify Data is wired.
 */
import type { Baseline, ReleaseStatus, ResourceEntity, RevisionRecord } from '../types/plm';
import { ALL_ENTITIES } from '../data/tarSeedData';
import { SEED_REVISION_HISTORY } from '../data/revisionSeed';
import { SEED_BASELINES } from '../data/baselinesSeed';
import { makeRevisionRecord, nextRevision, sortHistoryNewestFirst } from './revisionUtils';

const STORAGE_KEY = 'vector-plm-config-v1';

export type EntityOverlay = {
  revision: string;
  status: ReleaseStatus;
  lastModified: string;
  modifiedBy?: string;
  /** Field overlays — when set, replace seed values in the UI */
  name?: string;
  description?: string;
  notes?: string;
};

type StoreState = {
  overlays: Record<string, EntityOverlay>;
  extraHistory: RevisionRecord[];
  extraBaselines: Baseline[];
};

function emptyState(): StoreState {
  return { overlays: {}, extraHistory: [], extraBaselines: [] };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      overlays: parsed.overlays || {},
      extraHistory: parsed.extraHistory || [],
      extraBaselines: parsed.extraBaselines || [],
    };
  } catch {
    return emptyState();
  }
}

function save(state: StoreState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota */
  }
}

let state: StoreState = load();
const listeners = new Set<() => void>();

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

/** Merge seed entity with revision + field overlays */
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
    // notes is overlay-only until schema adds it; stash on entity via cast for UI
    ...(o.notes !== undefined ? { notes: o.notes } : {}),
  } as ResourceEntity & { notes?: string };
}

export function getEntityById(id: string): ResourceEntity | undefined {
  const base = ALL_ENTITIES.find((e) => e.id === id);
  return base ? applyOverlay(base) : undefined;
}

export function getAllEntitiesWithOverlays(): ResourceEntity[] {
  return ALL_ENTITIES.map(applyOverlay);
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

/**
 * Update editable fields on an entity (name, description, notes).
 * Does not bump revision by itself — caller can bump after if desired.
 */
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

  const nextOverlay: EntityOverlay = {
    revision: prev?.revision ?? current.revision,
    status: prev?.status ?? current.status,
    lastModified: now,
    modifiedBy: by,
    name: fields.name !== undefined ? fields.name : prev?.name,
    description: fields.description !== undefined ? fields.description : prev?.description,
    notes: fields.notes !== undefined ? fields.notes : prev?.notes,
  };

  // If name/description/notes explicitly passed as empty string, keep them (clear is valid)
  if (fields.name !== undefined) nextOverlay.name = fields.name;
  if (fields.description !== undefined) nextOverlay.description = fields.description;
  if (fields.notes !== undefined) nextOverlay.notes = fields.notes;

  state = {
    ...state,
    overlays: {
      ...state.overlays,
      [entityId]: nextOverlay,
    },
  };
  save(state);
  notify();
  return applyOverlay(current);
}

/**
 * Bump entity revision: updates overlay, appends immutable history record.
 * Preserves any field overlays (name/description/notes).
 */
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

  state = {
    ...state,
    overlays: {
      ...state.overlays,
      [entityId]: {
        revision: newRev,
        status: newStatus,
        lastModified: now,
        modifiedBy: by,
        name: prev?.name,
        description: prev?.description,
        notes: prev?.notes,
      },
    },
    extraHistory: [...state.extraHistory, record],
  };
  save(state);
  notify();

  return { entity: applyOverlay(current), record };
}

/** Freeze current (overlaid) revisions into a named baseline */
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
    if (!ids || ids.has(e.id)) {
      entityRevisions[e.id] = e.revision;
    }
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
  save(state);
  notify();
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
  save(state);
  notify();
}
