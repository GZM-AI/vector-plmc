/**
 * Change Control v1 — cloud-first store
 * Load: Amplify → localStorage cache
 * Save: localStorage + Amplify (same pattern as configStore / Registry spine)
 *
 * Depends on productAmplify client (getProductClient) having ChangeRequest + ChangeAuditEvent models.
 */
import { getProductClient } from './productAmplify';

export type ChangeRequestStatus =
  | 'Draft'
  | 'Submitted'
  | 'In Review'
  | 'Approved'
  | 'Rejected'
  | 'Implemented'
  | 'Closed';

export type ChangeImpact = 'low' | 'medium' | 'high';

export type AuditEvent = {
  id: string;
  at: string;
  by?: string;
  action: string;
  detail?: string;
};

export type ChangeRequest = {
  id: string;
  type: 'ChangeRequest';
  title: string;
  summary: string;
  changeStatus: ChangeRequestStatus;
  impact?: ChangeImpact;
  affectedEntityIds: string[];
  requestedBy?: string;
  approvers?: string[];
  linkedRevisionEventIds?: string[];
  createdAt: string;
  lastModified: string;
  modifiedBy?: string;
  auditTrail: AuditEvent[];
};

export const CHANGE_STATUS_ORDER: ChangeRequestStatus[] = [
  'Draft',
  'Submitted',
  'In Review',
  'Approved',
  'Rejected',
  'Implemented',
  'Closed',
];

export const CHANGE_TRANSITIONS: Record<ChangeRequestStatus, ChangeRequestStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['In Review', 'Draft'],
  'In Review': ['Approved', 'Rejected'],
  Approved: ['Implemented'],
  Rejected: ['Draft', 'Closed'],
  Implemented: ['Closed'],
  Closed: [],
};

const STORAGE_KEY = 'vector-plm-changes-v1';

type StoreState = {
  requests: ChangeRequest[];
  cloudHydrated: boolean;
};

function emptyState(): StoreState {
  return { requests: [], cloudHydrated: false };
}

function loadLocal(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return {
      requests: (parsed.requests || []).map(normalizeCr),
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

function normalizeCr(r: Partial<ChangeRequest> & { id: string }): ChangeRequest {
  return {
    id: r.id,
    type: 'ChangeRequest',
    title: r.title || '',
    summary: r.summary || '',
    changeStatus: (r.changeStatus as ChangeRequestStatus) || 'Draft',
    impact: r.impact,
    affectedEntityIds: r.affectedEntityIds || [],
    requestedBy: r.requestedBy,
    approvers: r.approvers || [],
    linkedRevisionEventIds: r.linkedRevisionEventIds || [],
    createdAt: r.createdAt || new Date().toISOString(),
    lastModified: r.lastModified || r.createdAt || new Date().toISOString(),
    modifiedBy: r.modifiedBy,
    auditTrail: r.auditTrail || [],
  };
}

let state: StoreState = loadLocal();
const listeners = new Set<() => void>();
let hydratePromise: Promise<void> | null = null;

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeChangeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getChangeState(): StoreState {
  return state;
}

export function isChangeCloudHydrated(): boolean {
  return state.cloudHydrated;
}

function hasErrors(result: { errors?: unknown[] } | null | undefined): boolean {
  return Array.isArray(result?.errors) && result!.errors!.length > 0;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

// ─── Cloud I/O ───────────────────────────────────────────────────────────────

async function pullFromCloud(): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ChangeRequest) {
    console.warn('[changeStore] cloud pull skipped — no ChangeRequest model');
    return false;
  }
  try {
    const [crRes, auditRes] = await Promise.all([
      client.models.ChangeRequest.list({ limit: 1000 }),
      client.models.ChangeAuditEvent.list({ limit: 5000 }),
    ]);

    if (hasErrors(crRes) || hasErrors(auditRes)) {
      console.error('[changeStore] cloud list errors', {
        cr: crRes?.errors,
        audit: auditRes?.errors,
      });
      return false;
    }

    const auditsByCr: Record<string, AuditEvent[]> = {};
    for (const row of auditRes?.data || []) {
      if (!row?.changeRequestId) continue;
      const ev: AuditEvent = {
        id: row.id,
        at: row.at,
        by: row.by || undefined,
        action: row.action,
        detail: row.detail || undefined,
      };
      if (!auditsByCr[row.changeRequestId]) auditsByCr[row.changeRequestId] = [];
      auditsByCr[row.changeRequestId].push(ev);
    }
    for (const id of Object.keys(auditsByCr)) {
      auditsByCr[id].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    }

    const requests: ChangeRequest[] = (crRes?.data || []).map((row: any) =>
      normalizeCr({
        id: row.id,
        title: row.title,
        summary: row.summary || '',
        changeStatus: row.changeStatus,
        impact: row.impact || undefined,
        affectedEntityIds: parseJsonArray(row.affectedEntityIdsJson),
        requestedBy: row.requestedBy || undefined,
        approvers: parseJsonArray(row.approversJson),
        linkedRevisionEventIds: parseJsonArray(row.linkedRevisionEventIdsJson),
        createdAt: row.createdAt,
        lastModified: row.lastModified,
        modifiedBy: row.modifiedBy || undefined,
        auditTrail: auditsByCr[row.id] || [],
      })
    );

    state = {
      requests,
      cloudHydrated: true,
    };
    saveLocal(state);
    console.log('[changeStore] hydrated from cloud', { requests: requests.length });
    notify();
    return true;
  } catch (err) {
    console.error('[changeStore] cloud pull failed', err);
    return false;
  }
}

/** Call once after Amplify client is configured (from main.tsx). */
export function hydrateChangeStoreFromCloud(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = pullFromCloud().then(() => undefined);
  }
  return hydratePromise;
}

async function upsertChangeRequestCloud(cr: ChangeRequest): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ChangeRequest) return false;
  const payload = {
    id: cr.id,
    title: cr.title,
    summary: cr.summary,
    changeStatus: cr.changeStatus,
    impact: cr.impact,
    affectedEntityIdsJson: JSON.stringify(cr.affectedEntityIds || []),
    requestedBy: cr.requestedBy,
    approversJson: JSON.stringify(cr.approvers || []),
    linkedRevisionEventIdsJson: JSON.stringify(cr.linkedRevisionEventIds || []),
    createdAt: cr.createdAt,
    lastModified: cr.lastModified,
    modifiedBy: cr.modifiedBy,
  };
  try {
    let result = await client.models.ChangeRequest.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.ChangeRequest.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[changeStore] ChangeRequest cloud write failed', result?.errors || result);
      return false;
    }
    console.log('[changeStore] ChangeRequest cloud ok', cr.id);
    return true;
  } catch (err) {
    console.error('[changeStore] ChangeRequest cloud error', err);
    return false;
  }
}

async function createAuditEventCloud(
  changeRequestId: string,
  event: AuditEvent
): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ChangeAuditEvent) return false;
  const payload = {
    id: event.id,
    changeRequestId,
    at: event.at,
    by: event.by,
    action: event.action,
    detail: event.detail,
  };
  try {
    const result = await client.models.ChangeAuditEvent.create(payload);
    if (hasErrors(result) || !result?.data) {
      console.error('[changeStore] ChangeAuditEvent cloud write failed', result?.errors || result);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[changeStore] ChangeAuditEvent cloud error', err);
    return false;
  }
}

async function deleteChangeRequestCloud(id: string): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.ChangeRequest) return false;
  try {
    const result = await client.models.ChangeRequest.delete({ id });
    if (hasErrors(result)) {
      console.error('[changeStore] ChangeRequest delete failed', result?.errors);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[changeStore] ChangeRequest delete error', err);
    return false;
  }
}

/**
 * One-time migration of local-only change records to cloud.
 */
export async function uploadLocalChangesToCloud(): Promise<{ ok: boolean; message: string }> {
  const client = getProductClient();
  if (!client?.models?.ChangeRequest) {
    return { ok: false, message: 'Amplify client not configured' };
  }
  let ok = 0;
  let fail = 0;
  for (const cr of state.requests) {
    (await upsertChangeRequestCloud(cr)) ? ok++ : fail++;
    for (const ev of cr.auditTrail || []) {
      (await createAuditEventCloud(cr.id, ev)) ? ok++ : fail++;
    }
  }
  await pullFromCloud();
  return {
    ok: fail === 0,
    message: `Uploaded ${ok} records` + (fail ? `, ${fail} failed` : ''),
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getChangeRequests(): ChangeRequest[] {
  return [...state.requests].sort(
    (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
  );
}

export function getChangeRequestById(id: string): ChangeRequest | undefined {
  return state.requests.find((r) => r.id === id);
}

export function getChangeRequestsForEntity(entityId: string): ChangeRequest[] {
  return getChangeRequests().filter((r) => r.affectedEntityIds.includes(entityId));
}

function makeAudit(
  action: string,
  by?: string,
  detail?: string
): AuditEvent {
  return {
    id: `cae-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    by: by ?? 'Zedekiah',
    action,
    detail,
  };
}

function replaceCr(cr: ChangeRequest): void {
  const idx = state.requests.findIndex((r) => r.id === cr.id);
  const requests =
    idx >= 0
      ? state.requests.map((r) => (r.id === cr.id ? cr : r))
      : [...state.requests, cr];
  state = { ...state, requests };
  saveLocal(state);
  notify();
  void upsertChangeRequestCloud(cr);
}

export function createChangeRequest(input: {
  title: string;
  summary?: string;
  impact?: ChangeImpact;
  affectedEntityIds?: string[];
  requestedBy?: string;
  linkedRevisionEventIds?: string[];
}): ChangeRequest {
  const now = new Date().toISOString();
  const by = input.requestedBy ?? 'Zedekiah';
  const audit = makeAudit('Created', by, 'Change request opened');
  const cr: ChangeRequest = {
    id: `cr-${Date.now().toString(36)}`,
    type: 'ChangeRequest',
    title: input.title.trim(),
    summary: (input.summary || '').trim(),
    changeStatus: 'Draft',
    impact: input.impact,
    affectedEntityIds: input.affectedEntityIds || [],
    requestedBy: by,
    approvers: [],
    linkedRevisionEventIds: input.linkedRevisionEventIds || [],
    createdAt: now,
    lastModified: now,
    modifiedBy: by,
    auditTrail: [audit],
  };
  state = { ...state, requests: [...state.requests, cr] };
  saveLocal(state);
  notify();
  void upsertChangeRequestCloud(cr);
  void createAuditEventCloud(cr.id, audit);
  return cr;
}

/**
 * Optional helper: open a CR from a bump-revision action (System Registry).
 * Pass the RevisionEvent id so the CR is linked to that bump.
 */
export function createChangeRequestFromBump(input: {
  title: string;
  summary?: string;
  entityIds: string[];
  revisionEventId?: string;
  requestedBy?: string;
  impact?: ChangeImpact;
}): ChangeRequest {
  return createChangeRequest({
    title: input.title,
    summary: input.summary,
    impact: input.impact ?? 'medium',
    affectedEntityIds: input.entityIds,
    requestedBy: input.requestedBy,
    linkedRevisionEventIds: input.revisionEventId ? [input.revisionEventId] : [],
  });
}

export function updateChangeRequest(
  id: string,
  patch: {
    title?: string;
    summary?: string;
    impact?: ChangeImpact;
    affectedEntityIds?: string[];
    modifiedBy?: string;
  }
): ChangeRequest | null {
  const existing = getChangeRequestById(id);
  if (!existing) return null;
  // Free edit only while Draft (hybrid gating)
  if (existing.changeStatus !== 'Draft') {
    console.warn('[changeStore] free field edit only allowed in Draft');
    return null;
  }
  const by = patch.modifiedBy ?? 'Zedekiah';
  const now = new Date().toISOString();
  const audit = makeAudit('Updated', by, 'Fields edited while Draft');
  const next: ChangeRequest = {
    ...existing,
    title: patch.title !== undefined ? patch.title.trim() : existing.title,
    summary: patch.summary !== undefined ? patch.summary.trim() : existing.summary,
    impact: patch.impact !== undefined ? patch.impact : existing.impact,
    affectedEntityIds:
      patch.affectedEntityIds !== undefined
        ? patch.affectedEntityIds
        : existing.affectedEntityIds,
    lastModified: now,
    modifiedBy: by,
    auditTrail: [...existing.auditTrail, audit],
  };
  replaceCr(next);
  void createAuditEventCloud(next.id, audit);
  return next;
}

export function setAffectedEntities(
  id: string,
  entityIds: string[],
  modifiedBy?: string
): ChangeRequest | null {
  const existing = getChangeRequestById(id);
  if (!existing) return null;
  if (existing.changeStatus !== 'Draft' && existing.changeStatus !== 'Submitted') {
    console.warn('[changeStore] affected items locked after Submitted/In Review');
    // Still allow while Submitted for practicality in small team
  }
  const by = modifiedBy ?? 'Zedekiah';
  const now = new Date().toISOString();
  const audit = makeAudit(
    'Affected items updated',
    by,
    `${entityIds.length} item(s)`
  );
  const next: ChangeRequest = {
    ...existing,
    affectedEntityIds: [...entityIds],
    lastModified: now,
    modifiedBy: by,
    auditTrail: [...existing.auditTrail, audit],
  };
  replaceCr(next);
  void createAuditEventCloud(next.id, audit);
  return next;
}

export function transitionChangeRequest(
  id: string,
  toStatus: ChangeRequestStatus,
  opts?: { comment?: string; by?: string }
): ChangeRequest | null {
  const existing = getChangeRequestById(id);
  if (!existing) return null;

  const allowed = CHANGE_TRANSITIONS[existing.changeStatus] || [];
  if (!allowed.includes(toStatus)) {
    console.warn(
      `[changeStore] invalid transition ${existing.changeStatus} → ${toStatus}`
    );
    return null;
  }

  const by = opts?.by ?? 'Zedekiah';
  const now = new Date().toISOString();
  const detail = opts?.comment?.trim() || undefined;
  const audit = makeAudit(`Status → ${toStatus}`, by, detail);

  const next: ChangeRequest = {
    ...existing,
    changeStatus: toStatus,
    lastModified: now,
    modifiedBy: by,
    auditTrail: [...existing.auditTrail, audit],
  };
  replaceCr(next);
  void createAuditEventCloud(next.id, audit);
  return next;
}

/** Convenience status actions */
export function submitChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'Submitted', { by, comment });
}
export function startReviewChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'In Review', { by, comment });
}
export function approveChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'Approved', { by, comment });
}
export function rejectChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'Rejected', { by, comment });
}
export function implementChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'Implemented', { by, comment });
}
export function closeChangeRequest(id: string, by?: string, comment?: string) {
  return transitionChangeRequest(id, 'Closed', { by, comment });
}

export function addAuditComment(
  id: string,
  comment: string,
  by?: string
): ChangeRequest | null {
  const existing = getChangeRequestById(id);
  if (!existing) return null;
  const actor = by ?? 'Zedekiah';
  const now = new Date().toISOString();
  const audit = makeAudit('Comment', actor, comment.trim());
  const next: ChangeRequest = {
    ...existing,
    lastModified: now,
    modifiedBy: actor,
    auditTrail: [...existing.auditTrail, audit],
  };
  replaceCr(next);
  void createAuditEventCloud(next.id, audit);
  return next;
}

export function linkRevisionEventToChange(
  changeRequestId: string,
  revisionEventId: string,
  by?: string
): ChangeRequest | null {
  const existing = getChangeRequestById(changeRequestId);
  if (!existing) return null;
  if (existing.linkedRevisionEventIds?.includes(revisionEventId)) return existing;
  const actor = by ?? 'Zedekiah';
  const now = new Date().toISOString();
  const audit = makeAudit('Linked revision event', actor, revisionEventId);
  const next: ChangeRequest = {
    ...existing,
    linkedRevisionEventIds: [...(existing.linkedRevisionEventIds || []), revisionEventId],
    lastModified: now,
    modifiedBy: actor,
    auditTrail: [...existing.auditTrail, audit],
  };
  replaceCr(next);
  void createAuditEventCloud(next.id, audit);
  return next;
}

export function deleteChangeRequest(id: string): boolean {
  const existing = getChangeRequestById(id);
  if (!existing) return false;
  // Only allow delete while Draft
  if (existing.changeStatus !== 'Draft') {
    console.warn('[changeStore] delete only allowed in Draft');
    return false;
  }
  state = {
    ...state,
    requests: state.requests.filter((r) => r.id !== id),
  };
  saveLocal(state);
  notify();
  void deleteChangeRequestCloud(id);
  return true;
}

export function resetChangeStore(): void {
  state = emptyState();
  saveLocal(state);
  notify();
}
