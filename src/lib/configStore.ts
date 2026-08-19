/**
 * Phase 1 — Client configuration store
 * Persists revision overlays, field edits, user-added children, history,
 * and baselines in localStorage until Amplify Data is wired.
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

/** Child types users can add under System / Subsystem (R&D) */
export type AddableChildType = Extract<
  StructuralEntityType,
  'Component' | 'SoftwareItem' | 'Interface' | 'Capability'
>;

type StoreState = {
  overlays: Record<string, EntityOverlay>;
  extraEntities: ResourceEntity[];
  extraHistory: RevisionRecord[];
  extraBaselines: Baseline[];
};

function emptyState(): StoreState {
  return { overlays: {}, extraEntities: [], extraHistory: [], extraBaselines: [] };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      overlays: parsed.overlays || {},
      extraEntities: parsed.extraEntities || [],
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
    ...(o.notes !== undefined ? { notes: o.notes } : {}),
  } as ResourceEntity & { notes?: string };
}

/** Flat list: seed + user-created entities, with overlays applied */
export function getMergedAllEntities(): ResourceEntity[] {
  const seedIds = new Set(ALL_ENTITIES.map((e) => e.id));
  const extras = state.extraEntities.filter((e) => !seedIds.has(e.id));
  return [...ALL_ENTITIES, ...extras].map((e) => applyOverlay(e));
}

/**
 * Nested tree for Registry: seed TAR_TREE + inject user children by parentId.
 */
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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32) || 'item';
}

/**
 * Add a child under a System or Subsystem (R&D structure growth).
 */
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
  if (parent.type !== 'System' && parent.type !== 'Subsystem') {
    console.warn('[configStore] addChildEntity: parent must be System or Subsystem');
    return null;
  }

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
  save(state);
  notify();
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

  // Also patch extraEntities name/description so tree labels stay correct
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
    overlays: {
      ...state.overlays,
      [entityId]: nextOverlay,
    },
  };
  save(state);
  notify();
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

  // Keep extra entity revision in sync
  if (state.extraEntities.some((e) => e.id === entityId)) {
    state = {
      ...state,
      extraEntities: state.extraEntities.map((e) =>
        e.id === entityId
          ? { ...e, revision: newRev, status: newStatus, lastModified: now, modifiedBy: by }
          : e
      ),
    };
  }

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
