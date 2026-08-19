/**
 * Phase 1 — Client configuration store
 * Persists revision overlays, history appends, and baselines in localStorage
 * until Amplify Data is wired. System Architecture is not affected.
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

/** Merge seed entity with any revision overlay */
export function applyOverlay(entity: ResourceEntity): ResourceEntity {
  const o = state.overlays[entity.id];
  if (!o) return entity;
  return {
    ...entity,
    revision: o.revision,
    status: o.status,
    lastModified: o.lastModified,
    modifiedBy: o.modifiedBy ?? entity.modifiedBy,
  };
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
 * Bump entity revision: updates overlay, appends immutable history record.
 * Returns the new revision string.
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
  /** If omitted, freezes all entities */
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

/** Compare two revision labels for the same entity using history comments */
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
