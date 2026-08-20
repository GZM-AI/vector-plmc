/**
 * Suppliers store — vendors, manufacturers, integrators
 * Linked to System Registry entity ids for parametric sourcing.
 * localStorage until Amplify product store.
 */

export type SupplierKind = 'Vendor' | 'Manufacturer' | 'Integrator' | 'Distributor' | 'Other';
export type EngagementStatus =
  | 'Identified'
  | 'Contacted'
  | 'NDA'
  | 'Quoting'
  | 'Selected'
  | 'Active'
  | 'On hold'
  | 'Dropped';
export type MakeBuy = 'Buy' | 'Make' | 'Make-or-buy' | 'Undecided';
export type SourcingRisk = 'Low' | 'Medium' | 'High' | 'Unknown';

export type Supplier = {
  id: string;
  name: string;
  kind: SupplierKind;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  location?: string;
  engagement: EngagementStatus;
  risk: SourcingRisk;
  notes?: string;
  entityIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type EntitySourcing = {
  entityId: string;
  makeBuy: MakeBuy;
  preferredSupplierId?: string;
  notes?: string;
  updatedAt: string;
};

type StoreState = {
  suppliers: Supplier[];
  entitySourcing: Record<string, EntitySourcing>;
};

const STORAGE_KEY = 'vector-plm-suppliers-v1';

function emptyState(): StoreState {
  return { suppliers: [], entitySourcing: {} };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      suppliers: parsed.suppliers || [],
      entitySourcing: parsed.entitySourcing || {},
    };
  } catch {
    return emptyState();
  }
}

function save(state: StoreState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

let state: StoreState = load();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeSuppliersStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getSuppliers(): Supplier[] {
  return [...state.suppliers].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSupplierById(id: string): Supplier | undefined {
  return state.suppliers.find((s) => s.id === id);
}

export function getSuppliersForEntity(entityId: string): Supplier[] {
  return state.suppliers.filter((s) => s.entityIds.includes(entityId));
}

export function getEntitySourcing(entityId: string): EntitySourcing {
  return (
    state.entitySourcing[entityId] || {
      entityId,
      makeBuy: 'Undecided',
      updatedAt: new Date().toISOString(),
    }
  );
}

export function upsertSupplier(
  input: Partial<Supplier> & { name: string }
): Supplier {
  const now = new Date().toISOString();
  if (input.id) {
    const existing = state.suppliers.find((s) => s.id === input.id);
    if (existing) {
      const next: Supplier = {
        ...existing,
        ...input,
        id: existing.id,
        name: input.name.trim(),
        entityIds: input.entityIds ?? existing.entityIds,
        updatedAt: now,
      };
      state = {
        ...state,
        suppliers: state.suppliers.map((s) => (s.id === next.id ? next : s)),
      };
      save(state);
      notify();
      return next;
    }
  }

  const created: Supplier = {
    id: `sup-${Date.now().toString(36)}`,
    name: input.name.trim(),
    kind: input.kind ?? 'Vendor',
    website: input.website,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    location: input.location,
    engagement: input.engagement ?? 'Identified',
    risk: input.risk ?? 'Unknown',
    notes: input.notes,
    entityIds: input.entityIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
  state = { ...state, suppliers: [...state.suppliers, created] };
  save(state);
  notify();
  return created;
}

export function deleteSupplier(id: string): void {
  state = {
    suppliers: state.suppliers.filter((s) => s.id !== id),
    entitySourcing: Object.fromEntries(
      Object.entries(state.entitySourcing).map(([eid, es]) => [
        eid,
        es.preferredSupplierId === id ? { ...es, preferredSupplierId: undefined } : es,
      ])
    ),
  };
  save(state);
  notify();
}

export function linkSupplierToEntity(supplierId: string, entityId: string): void {
  state = {
    ...state,
    suppliers: state.suppliers.map((s) =>
      s.id === supplierId && !s.entityIds.includes(entityId)
        ? { ...s, entityIds: [...s.entityIds, entityId], updatedAt: new Date().toISOString() }
        : s
    ),
  };
  save(state);
  notify();
}

export function unlinkSupplierFromEntity(supplierId: string, entityId: string): void {
  state = {
    ...state,
    suppliers: state.suppliers.map((s) =>
      s.id === supplierId
        ? {
            ...s,
            entityIds: s.entityIds.filter((id) => id !== entityId),
            updatedAt: new Date().toISOString(),
          }
        : s
    ),
  };
  save(state);
  notify();
}

export function setEntitySourcing(
  entityId: string,
  patch: Partial<Omit<EntitySourcing, 'entityId'>>
): EntitySourcing {
  const prev = getEntitySourcing(entityId);
  const next: EntitySourcing = {
    ...prev,
    ...patch,
    entityId,
    updatedAt: new Date().toISOString(),
  };
  state = {
    ...state,
    entitySourcing: { ...state.entitySourcing, [entityId]: next },
  };
  save(state);
  notify();
  return next;
}

export function resetSuppliersStore(): void {
  state = emptyState();
  save(state);
  notify();
}