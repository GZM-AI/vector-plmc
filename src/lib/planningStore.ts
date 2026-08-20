/**
 * Planning & Cost — cloud-first (Amplify PlanLine) + local cache
 */
import type { ResourceEntity } from '../types/plm';
import { getProductClient } from './productAmplify';

export type CostConfidence = 'Rough' | 'Budget' | 'Firm';
export type PlanStatus = 'Not started' | 'In progress' | 'Complete' | 'Blocked';

export type PlanLine = {
  entityId: string;
  nre: number;
  unitCost: number;
  qty: number;
  leadTimeDays: number;
  confidence: CostConfidence;
  note: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
};

const STORAGE_KEY = 'vector-plm-planning-v1';

type StoreState = { lines: Record<string, PlanLine> };

function emptyState(): StoreState {
  return { lines: {} };
}

function loadLocal(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return { lines: parsed.lines || {} };
  } catch {
    return emptyState();
  }
}

function saveLocal(state: StoreState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function hasErrors(result: { errors?: unknown[] } | null | undefined): boolean {
  return Array.isArray(result?.errors) && result!.errors!.length > 0;
}

export function subscribePlanningStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function defaultPlanLine(entityId: string): PlanLine {
  return {
    entityId,
    nre: 0,
    unitCost: 0,
    qty: 1,
    leadTimeDays: 0,
    confidence: 'Rough',
    note: '',
    status: 'Not started',
    startDate: '',
    endDate: '',
  };
}

export function getPlanLine(entityId: string): PlanLine {
  return state.lines[entityId] ? { ...state.lines[entityId] } : defaultPlanLine(entityId);
}

export function getAllPlanLines(): Record<string, PlanLine> {
  return { ...state.lines };
}

async function upsertPlanLineCloud(line: PlanLine): Promise<boolean> {
  const client = getProductClient();
  if (!client?.models?.PlanLine) {
    console.warn('[planningStore] no PlanLine model / client');
    return false;
  }
  const payload = {
    entityId: line.entityId,
    nre: line.nre,
    unitCost: line.unitCost,
    qty: line.qty,
    leadTimeDays: line.leadTimeDays,
    confidence: line.confidence,
    note: line.note || '',
    status: line.status,
    startDate: line.startDate || '',
    endDate: line.endDate || '',
  };
  try {
    let result = await client.models.PlanLine.update(payload);
    if (hasErrors(result) || !result?.data) {
      result = await client.models.PlanLine.create(payload);
    }
    if (hasErrors(result) || !result?.data) {
      console.error('[planningStore] cloud write failed', result?.errors || result);
      return false;
    }
    console.log('[planningStore] plan line cloud ok', line.entityId);
    return true;
  } catch (err) {
    console.error('[planningStore] cloud error', err);
    return false;
  }
}

export async function hydratePlanningFromCloud(): Promise<void> {
  const client = getProductClient();
  if (!client?.models?.PlanLine) {
    console.warn('[planningStore] hydrate skipped — no client');
    return;
  }
  try {
    const result = await client.models.PlanLine.list({ limit: 2000 });
    if (hasErrors(result)) {
      console.error('[planningStore] list errors', result.errors);
      return;
    }
    const lines: Record<string, PlanLine> = {};
    for (const row of result?.data || []) {
      if (!row?.entityId) continue;
      lines[row.entityId] = {
        entityId: row.entityId,
        nre: Number(row.nre) || 0,
        unitCost: Number(row.unitCost) || 0,
        qty: Number(row.qty) || 0,
        leadTimeDays: Number(row.leadTimeDays) || 0,
        confidence: (row.confidence as CostConfidence) || 'Rough',
        note: row.note || '',
        status: (row.status as PlanStatus) || 'Not started',
        startDate: row.startDate || '',
        endDate: row.endDate || '',
      };
    }
    state = { lines };
    saveLocal(state);
    console.log('[planningStore] hydrated from cloud', Object.keys(lines).length, 'lines');
    notify();
  } catch (err) {
    console.error('[planningStore] hydrate failed', err);
  }
}

export function ensurePlanningHydrated(): Promise<void> {
  if (!hydratePromise) hydratePromise = hydratePlanningFromCloud();
  return hydratePromise;
}

export function upsertPlanLine(
  entityId: string,
  patch: Partial<Omit<PlanLine, 'entityId'>>
): PlanLine {
  const prev = getPlanLine(entityId);
  const next: PlanLine = {
    ...prev,
    ...patch,
    entityId,
    nre: Number.isFinite(patch.nre as number) ? Number(patch.nre) : prev.nre,
    unitCost: Number.isFinite(patch.unitCost as number) ? Number(patch.unitCost) : prev.unitCost,
    qty: Number.isFinite(patch.qty as number) ? Math.max(0, Number(patch.qty)) : prev.qty,
    leadTimeDays: Number.isFinite(patch.leadTimeDays as number)
      ? Math.max(0, Number(patch.leadTimeDays))
      : prev.leadTimeDays,
  };
  state = { lines: { ...state.lines, [entityId]: next } };
  saveLocal(state);
  notify();
  void upsertPlanLineCloud(next);
  return next;
}

export function lineTotal(line: PlanLine): number {
  return (line.nre || 0) + (line.unitCost || 0) * (line.qty || 0);
}

export function sumLines(lines: PlanLine[]): {
  nre: number;
  unit: number;
  total: number;
  missingCost: number;
} {
  let nre = 0;
  let unit = 0;
  let total = 0;
  let missingCost = 0;
  for (const l of lines) {
    nre += l.nre || 0;
    unit += (l.unitCost || 0) * (l.qty || 0);
    total += lineTotal(l);
    if (!(l.nre > 0) && !(l.unitCost > 0)) missingCost += 1;
  }
  return { nre, unit, total, missingCost };
}

export function collectCostableUnder(node: ResourceEntity): ResourceEntity[] {
  const children = node.children || [];
  if (children.length === 0) return [];
  const out: ResourceEntity[] = [];
  const walk = (n: ResourceEntity) => {
    const kids = n.children || [];
    if (kids.length === 0) {
      if (n.type !== 'System' && n.type !== 'Subsystem') out.push(n);
      return;
    }
    for (const k of kids) walk(k);
  };
  for (const c of children) walk(c);
  return out;
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function resetPlanningStore(): void {
  state = emptyState();
  saveLocal(state);
  notify();
}