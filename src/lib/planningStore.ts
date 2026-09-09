/**
 * Planning & Cost — cloud-first (Amplify PlanLine) + local cache
 * Each part holds three stacked tiers: Estimated | Quoted | Actual.
 */
import type { ResourceEntity } from '../types/plm';
import { getProductClient } from './productAmplify';

export type CostTier = 'Estimated' | 'Quoted' | 'Actual';
/** @deprecated use CostTier */
export type CostConfidence = CostTier;
export type PlanStatus = 'Not started' | 'In progress' | 'Complete' | 'Blocked';

export const COST_TIERS: CostTier[] = ['Estimated', 'Quoted', 'Actual'];

export type TierValues = {
  nre: number;
  unitCost: number;
  qty: number;
  leadTimeDays: number;
  status: PlanStatus;
  startDate: string;
  endDate: string;
  note: string;
};

export type PlanLine = {
  entityId: string;
  tiers: Record<CostTier, TierValues>;
  note: string;
  status: PlanStatus;
  startDate: string;
  endDate: string;
};

const STORAGE_KEY = 'vector-plm-planning-v1';
const TIERS_META_RE = /^\[\[plan-tiers\]\](\{[^]*?\})\n?/;

type StoreState = { lines: Record<string, PlanLine> };

function emptyTier(): TierValues {
  return {
    nre: 0,
    unitCost: 0,
    qty: 1,
    leadTimeDays: 0,
    status: 'Not started',
    startDate: '',
    endDate: '',
    note: '',
  };
}

function emptyTiers(): Record<CostTier, TierValues> {
  return {
    Estimated: emptyTier(),
    Quoted: emptyTier(),
    Actual: emptyTier(),
  };
}

function emptyState(): StoreState {
  return { lines: {} };
}

function mapLegacyConfidence(c: string | undefined): CostTier {
  if (c === 'Quoted' || c === 'Budget') return 'Quoted';
  if (c === 'Actual' || c === 'Firm') return 'Actual';
  return 'Estimated';
}

function parseTiersJson(raw: unknown): Record<CostTier, TierValues> | null {
  if (!raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, Partial<TierValues>>;
  const out = emptyTiers();
  for (const t of COST_TIERS) {
    const v = src[t];
    if (!v) continue;
    out[t] = {
      nre: Number(v.nre) || 0,
      unitCost: Number(v.unitCost) || 0,
      qty: Number.isFinite(Number(v.qty)) ? Number(v.qty) : 1,
      leadTimeDays: Number(v.leadTimeDays) || 0,
      status: (v.status as PlanStatus) || 'Not started',
      startDate: v.startDate || '',
      endDate: v.endDate || '',
      note: v.note || '',
    };
  }
  return out;
}

function unpackNote(note: string | undefined | null): {
  tiers: Record<CostTier, TierValues> | null;
  note: string;
} {
  if (!note) return { tiers: null, note: '' };
  const m = note.match(TIERS_META_RE);
  if (!m) return { tiers: null, note };
  try {
    return {
      tiers: parseTiersJson(JSON.parse(m[1])),
      note: note.slice(m[0].length) || '',
    };
  } catch {
    return { tiers: null, note };
  }
}

function packNote(line: PlanLine): string {
  return `[[plan-tiers]]${JSON.stringify(line.tiers)}\n${line.note || ''}`;
}

export function tierHasCost(t: TierValues): boolean {
  return (t.nre || 0) > 0 || (t.unitCost || 0) > 0;
}

export function tierTotal(t: TierValues): number {
  return (t.nre || 0) + (t.unitCost || 0) * (t.qty || 0);
}

export function workingTier(line: PlanLine): CostTier {
  if (tierHasCost(line.tiers.Actual)) return 'Actual';
  if (tierHasCost(line.tiers.Quoted)) return 'Quoted';
  return 'Estimated';
}

export function normalizePlanLine(raw: any, entityId: string): PlanLine {
  const unpacked = unpackNote(typeof raw?.note === 'string' ? raw.note : '');
  const fromObject = raw?.tiers ? parseTiersJson(raw.tiers) : null;
  let tiers = unpacked.tiers || fromObject;
  if (!tiers) {
    tiers = emptyTiers();
    const legacy: CostTier = mapLegacyConfidence(raw?.confidence);
    tiers[legacy] = {
      nre: Number(raw?.nre) || 0,
      unitCost: Number(raw?.unitCost) || 0,
      qty: Number.isFinite(Number(raw?.qty)) ? Number(raw.qty) : 1,
      leadTimeDays: Number(raw?.leadTimeDays) || 0,
      status: (raw?.status as PlanStatus) || 'Not started',
      startDate: raw?.startDate || '',
      endDate: raw?.endDate || '',
      note:
        unpacked.tiers
          ? unpacked.note
          : raw?.note && !String(raw.note).startsWith('[[plan-tiers]]')
            ? String(raw.note)
            : unpacked.note,
    };
  }
  return {
    entityId,
    tiers,
    note: unpacked.tiers ? unpacked.note : raw?.note && !String(raw.note).startsWith('[[plan-tiers]]') ? String(raw.note) : unpacked.note,
    status: (raw?.status as PlanStatus) || 'Not started',
    startDate: raw?.startDate || '',
    endDate: raw?.endDate || '',
  };
}

function loadLocal(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    const lines: Record<string, PlanLine> = {};
    for (const [id, line] of Object.entries(parsed.lines || {})) {
      lines[id] = normalizePlanLine(line, id);
    }
    return { lines };
  } catch {
    return emptyState();
  }
}

function saveLocal(state: StoreState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines: state.lines }));
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
    tiers: emptyTiers(),
    note: '',
    status: 'Not started',
    startDate: '',
    endDate: '',
  };
}

export function getPlanLine(entityId: string): PlanLine {
  return state.lines[entityId]
    ? normalizePlanLine(state.lines[entityId], entityId)
    : defaultPlanLine(entityId);
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
  const work = line.tiers[workingTier(line)];
  const payload = {
    entityId: line.entityId,
    nre: work.nre,
    unitCost: work.unitCost,
    qty: work.qty,
    leadTimeDays: work.leadTimeDays,
    confidence: workingTier(line),
    note: packNote(line),
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
      lines[row.entityId] = normalizePlanLine(row, row.entityId);
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
  patch: Partial<Omit<PlanLine, 'entityId' | 'tiers'>> & {
    tiers?: Record<CostTier, TierValues>;
  }
): PlanLine {
  const prev = getPlanLine(entityId);
  const next: PlanLine = {
    ...prev,
    ...patch,
    entityId,
    tiers: patch.tiers ? { ...emptyTiers(), ...patch.tiers } : prev.tiers,
    note: patch.note !== undefined ? patch.note : prev.note,
    status: patch.status !== undefined ? patch.status : prev.status,
    startDate: patch.startDate !== undefined ? patch.startDate : prev.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : prev.endDate,
  };
  state = { lines: { ...state.lines, [entityId]: next } };
  saveLocal(state);
  notify();
  void upsertPlanLineCloud(next);
  return next;
}

export function upsertTier(
  entityId: string,
  tier: CostTier,
  patch: Partial<TierValues>
): PlanLine {
  const prev = getPlanLine(entityId);
  const cur = prev.tiers[tier];
  const nextTier: TierValues = {
    ...emptyTier(),
    ...cur,
    nre: Number.isFinite(patch.nre as number) ? Number(patch.nre) : cur.nre,
    unitCost: Number.isFinite(patch.unitCost as number) ? Number(patch.unitCost) : cur.unitCost,
    qty: Number.isFinite(patch.qty as number) ? Math.max(0, Number(patch.qty)) : cur.qty,
    leadTimeDays: Number.isFinite(patch.leadTimeDays as number)
      ? Math.max(0, Number(patch.leadTimeDays))
      : cur.leadTimeDays,
    status: patch.status !== undefined ? patch.status : cur.status || 'Not started',
    startDate: patch.startDate !== undefined ? patch.startDate : cur.startDate || '',
    endDate: patch.endDate !== undefined ? patch.endDate : cur.endDate || '',
    note: patch.note !== undefined ? patch.note : cur.note || '',
  };
  return upsertPlanLine(entityId, {
    tiers: { ...prev.tiers, [tier]: nextTier },
  });
}

export function lineTotal(line: PlanLine): number {
  return tierTotal(line.tiers[workingTier(line)]);
}

export function lineHasAnyCost(line: PlanLine): boolean {
  return COST_TIERS.some((t) => tierHasCost(line.tiers[t]));
}

export function sumTier(lines: PlanLine[], tier: CostTier): {
  nre: number;
  unit: number;
  total: number;
} {
  let nre = 0;
  let unit = 0;
  let total = 0;
  for (const l of lines) {
    const v = l.tiers[tier];
    nre += v.nre || 0;
    unit += (v.unitCost || 0) * (v.qty || 0);
    total += tierTotal(v);
  }
  return { nre, unit, total };
}

export function sumLines(lines: PlanLine[]): {
  nre: number;
  unit: number;
  total: number;
  missingCost: number;
  estimated: number;
  quoted: number;
  actual: number;
} {
  let nre = 0;
  let unit = 0;
  let total = 0;
  let missingCost = 0;
  let estimated = 0;
  let quoted = 0;
  let actual = 0;
  for (const l of lines) {
    const work = l.tiers[workingTier(l)];
    nre += work.nre || 0;
    unit += (work.unitCost || 0) * (work.qty || 0);
    total += tierTotal(work);
    estimated += tierTotal(l.tiers.Estimated);
    quoted += tierTotal(l.tiers.Quoted);
    actual += tierTotal(l.tiers.Actual);
    if (!lineHasAnyCost(l)) missingCost += 1;
  }
  return { nre, unit, total, missingCost, estimated, quoted, actual };
}

/**
 * Vertical Integrators are sourcing candidates (companies / products),
 * not costed BOM lines. Skip the folder and everything under it.
 */
function isSourcingBranch(n: ResourceEntity): boolean {
  if (!n) return false;
  if (n.type === 'Capability') return true;
  const kind = (n as ResourceEntity & { kind?: string }).kind;
  if (kind === 'integrator' || kind === 'company' || kind === 'product') return true;
  return (n.name || '').trim().toLowerCase() === 'vertical integrators';
}

/** Costable design parts under a subsystem — excludes Vertical Integrators. */
export function collectCostableUnder(node: ResourceEntity): ResourceEntity[] {
  const children = node.children || [];
  if (children.length === 0) return [];
  const out: ResourceEntity[] = [];
  const walk = (n: ResourceEntity) => {
    if (isSourcingBranch(n)) return;
    const kids = (n.children || []).filter((k) => !isSourcingBranch(k));
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
