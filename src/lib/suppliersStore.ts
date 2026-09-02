/**
 * Suppliers store — vendors, manufacturers, integrators
 * Cloud-first: Amplify SupplierRecord + EntitySourcingRecord
 * Cache: localStorage (vector-plm-suppliers-v1)
 *
 * Load: Amplify → local cache
 * Save: local cache + Amplify
 * If cloud is empty and this device has records, they are uploaded once.
 */
import { getProductClient } from './productAmplify';

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
  subsystemIds: string[];
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
  cloudHydrated: boolean;
};

const STORAGE_KEY = 'vector-plm-suppliers-v1';

function emptyState(): StoreState {
  return { suppliers: [], entitySourcing: {}, cloudHydrated: false };
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x) => typeof x === 'string') as string[];
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function normalizeSupplier(s: Partial<Supplier> & { id: string; name: string }): Supplier {
  return {
    id: s.id,
    name: s.name,
    kind: (s.kind as SupplierKind) || 'Vendor',
    website: s.website || undefined,
    contactName: s.contactName || undefined,
    contactEmail: s.contactEmail || undefined,
    contactPhone: s.contactPhone || undefined,
    location: s.location || undefined,
    engagement: (s.engagement as EngagementStatus) || 'Identified',
    risk: (s.risk as SourcingRisk) || 'Unknown',
    notes: s.notes || undefined,
    entityIds: s.entityIds || [],
    subsystemIds: s.subsystemIds || [],
    createdAt: s.createdAt || new Date().toISOString(),
    updatedAt: s.updatedAt || s.createdAt || new Date().toISOString(),
  };
}

function loadLocal(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      suppliers: (parsed.suppliers || []).map((s) =>
        normalizeSupplier({ ...s, entityIds: s.entityIds || [], subsystemIds: s.subsystemIds || [] })
      ),
      entitySourcing: parsed.entitySourcing || {},
      cloudHydrated: false,
    };
  } catch {
    return emptyState();
  }
}

function saveLocal(next: StoreState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        suppliers: next.suppliers,
        entitySourcing: next.entitySourcing,
      })
    );
  } catch {
    /* ignore */
  }
}

function hasErrors(result: any): boolean {
  return Array.isArray(result?.errors) && result.errors.length > 0;
}

let state: StoreState = loadLocal();
const listeners = new Set<() => void>();
let hydratePromise: Promise<void> | null = null;

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

export function isSuppliersCloudHydrated(): boolean {
  return state.cloudHydrated;
}

async function upsertSupplierCloud(s: Supplier): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.SupplierRecord) return false;
  const payload = {
    id: s.id,
    name: s.name,
    kind: s.kind,
    website: s.website,
    contactName: s.contactName,
    contactEmail: s.contactEmail,
    contactPhone: s.contactPhone,
    location: s.location,
    engagement: s.engagement,
    risk: s.risk,
    notes: s.notes,
    entityIdsJson: JSON.stringify(s.entityIds || []),
    subsystemIdsJson: JSON.stringify(s.subsystemIds || []),
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
  try {
    let result = await client.models.SupplierRecord.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.SupplierRecord.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[suppliersStore] cloud write failed', result?.errors || result);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[suppliersStore] cloud write error', err);
    return false;
  }
}

async function deleteSupplierCloud(id: string): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.SupplierRecord) return false;
  try {
    const result = await client.models.SupplierRecord.delete({ id });
    if (hasErrors(result)) {
      console.error('[suppliersStore] cloud delete failed', result?.errors);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[suppliersStore] cloud delete error', err);
    return false;
  }
}

async function upsertSourcingCloud(es: EntitySourcing): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.EntitySourcingRecord) return false;
  const payload = {
    entityId: es.entityId,
    makeBuy: es.makeBuy,
    preferredSupplierId: es.preferredSupplierId,
    notes: es.notes,
    updatedAt: es.updatedAt,
  };
  try {
    let result = await client.models.EntitySourcingRecord.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.EntitySourcingRecord.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[suppliersStore] sourcing cloud write failed', result?.errors || result);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[suppliersStore] sourcing cloud error', err);
    return false;
  }
}

async function uploadLocalToCloud(): Promise<void> {
  for (const s of state.suppliers) {
    await upsertSupplierCloud(s);
  }
  for (const es of Object.values(state.entitySourcing)) {
    await upsertSourcingCloud(es);
  }
}

async function pullFromCloud(): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.SupplierRecord) {
    console.warn('[suppliersStore] SupplierRecord model missing — using local cache');
    return false;
  }
  try {
    const [supRes, srcRes] = await Promise.all([
      client.models.SupplierRecord.list({ limit: 1000 }),
      client.models.EntitySourcingRecord
        ? client.models.EntitySourcingRecord.list({ limit: 2000 })
        : Promise.resolve({ data: [] }),
    ]);

    if (hasErrors(supRes)) {
      console.error('[suppliersStore] cloud list errors', supRes?.errors);
      return false;
    }

    const suppliers: Supplier[] = (supRes?.data || []).map((row: any) =>
      normalizeSupplier({
        id: row.id,
        name: row.name,
        kind: row.kind,
        website: row.website,
        contactName: row.contactName,
        contactEmail: row.contactEmail,
        contactPhone: row.contactPhone,
        location: row.location,
        engagement: row.engagement,
        risk: row.risk,
        notes: row.notes,
        entityIds: parseJsonArray(row.entityIdsJson),
        subsystemIds: parseJsonArray(row.subsystemIdsJson),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    );

    const entitySourcing: Record<string, EntitySourcing> = {};
    if (!hasErrors(srcRes)) {
      for (const row of srcRes?.data || []) {
        if (!row?.entityId) continue;
        entitySourcing[row.entityId] = {
          entityId: row.entityId,
          makeBuy: (row.makeBuy as MakeBuy) || 'Undecided',
          preferredSupplierId: row.preferredSupplierId || undefined,
          notes: row.notes || undefined,
          updatedAt: row.updatedAt || new Date().toISOString(),
        };
      }
    }

    if (suppliers.length === 0 && state.suppliers.length > 0) {
      console.log('[suppliersStore] cloud empty — uploading local records', {
        local: state.suppliers.length,
      });
      await uploadLocalToCloud();
      state = { ...state, cloudHydrated: true };
      saveLocal(state);
      notify();
      return true;
    }

    state = {
      suppliers,
      entitySourcing: Object.keys(entitySourcing).length ? entitySourcing : state.entitySourcing,
      cloudHydrated: true,
    };
    saveLocal(state);
    console.log('[suppliersStore] hydrated from cloud', { suppliers: suppliers.length });
    notify();
    return true;
  } catch (err) {
    console.error('[suppliersStore] cloud pull failed', err);
    return false;
  }
}

/** Call once after Amplify client is configured (from main.tsx). */
export function hydrateSuppliersStoreFromCloud(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = pullFromCloud().then(() => undefined);
  }
  return hydratePromise;
}

export function upsertSupplier(input: Partial<Supplier> & { name: string }): Supplier {
  const now = new Date().toISOString();
  let saved: Supplier;
  if (input.id) {
    const existing = state.suppliers.find((s) => s.id === input.id);
    if (existing) {
      saved = normalizeSupplier({
        ...existing,
        ...input,
        id: existing.id,
        name: input.name.trim(),
        entityIds: input.entityIds ?? existing.entityIds,
        subsystemIds: input.subsystemIds ?? existing.subsystemIds ?? [],
        createdAt: existing.createdAt,
        updatedAt: now,
      });
      state = {
        ...state,
        suppliers: state.suppliers.map((s) => (s.id === saved.id ? saved : s)),
      };
      saveLocal(state);
      notify();
      void upsertSupplierCloud(saved);
      return saved;
    }
  }

  saved = normalizeSupplier({
    id: input.id || `sup-${Date.now().toString(36)}`,
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
    subsystemIds: input.subsystemIds ?? [],
    createdAt: now,
    updatedAt: now,
  });
  state = { ...state, suppliers: [...state.suppliers, saved] };
  saveLocal(state);
  notify();
  void upsertSupplierCloud(saved);
  return saved;
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
    cloudHydrated: state.cloudHydrated,
  };
  saveLocal(state);
  notify();
  void deleteSupplierCloud(id);
}

export function linkSupplierToEntity(supplierId: string, entityId: string): void {
  const existing = state.suppliers.find((s) => s.id === supplierId);
  if (!existing || existing.entityIds.includes(entityId)) return;
  const next = {
    ...existing,
    entityIds: [...existing.entityIds, entityId],
    updatedAt: new Date().toISOString(),
  };
  state = {
    ...state,
    suppliers: state.suppliers.map((s) => (s.id === supplierId ? next : s)),
  };
  saveLocal(state);
  notify();
  void upsertSupplierCloud(next);
}

export function unlinkSupplierFromEntity(supplierId: string, entityId: string): void {
  const existing = state.suppliers.find((s) => s.id === supplierId);
  if (!existing) return;
  const next = {
    ...existing,
    entityIds: existing.entityIds.filter((id) => id !== entityId),
    updatedAt: new Date().toISOString(),
  };
  state = {
    ...state,
    suppliers: state.suppliers.map((s) => (s.id === supplierId ? next : s)),
  };
  saveLocal(state);
  notify();
  void upsertSupplierCloud(next);
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
  saveLocal(state);
  notify();
  void upsertSourcingCloud(next);
  return next;
}

export function resetSuppliersStore(): void {
  state = emptyState();
  saveLocal(state);
  notify();
}
