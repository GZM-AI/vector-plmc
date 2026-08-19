/**
 * Planning & Cost store
 * Per-entity schedule + cost lines keyed by Registry entityId.
 * localStorage until Amplify product store is wired.
 */
import type { ResourceEntity } from '../types/plm';

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
  /** ISO date YYYY-MM-DD */
  startDate: string;
  /** ISO date YYYY-MM-DD */
  endDate: string;
};

const STORAGE_KEY = 'vector-plm-planning-v1';

type StoreState = {
  lines: Record<string, PlanLine>;
};

function emptyState(): StoreState {
  return { lines: {} };
}

function load(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as StoreState;
    return { lines: parsed.lines || {} };
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
  state = {
    lines: {
      ...state.lines,
      [entityId]: next,
    },
  };
  save(state);
  notify();
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

/** Leaf entities under a node (no further children), for cost entry */
export function collectLeafEntities(node: ResourceEntity): ResourceEntity[] {
  const children = node.children || [];
  if (children.length === 0) {
    // node itself may be a leaf component under a subsystem
    return node.type !== 'System' && node.type !== 'Subsystem' ? [node] : [];
  }
  const out: ResourceEntity[] = [];
  for (const c of children) {
    if (c.children && c.children.length > 0) {
      out.push(...collectLeafEntities(c));
    } else {
      out.push(c);
    }
  }
  return out;
}

/** All costable entities under a subsystem (direct + nested leaves) */
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
  save(state);
  notify();
}
