/**
 * Persist sibling order under a Registry parent (subsystem, component, etc.).
 * Used by System Registry listings; getRegistryTree() should apply sortChildren().
 */
const STORAGE_KEY = 'vector-plm-child-order-v1';

type OrderMap = Record<string, string[]>;

const listeners = new Set<() => void>();

function load(): OrderMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OrderMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function save(map: OrderMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

let state: OrderMap = load();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeChildOrderStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function sortChildren<T extends { id: string }>(parentId: string, children: T[]): T[] {
  const order = state[parentId];
  if (!order || order.length === 0) return children;
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...children].sort((a, b) => {
    const ia = rank.has(a.id) ? (rank.get(a.id) as number) : 10000 + children.indexOf(a);
    const ib = rank.has(b.id) ? (rank.get(b.id) as number) : 10000 + children.indexOf(b);
    return ia - ib;
  });
}

export function moveChild(
  parentId: string,
  childIds: string[],
  childId: string,
  direction: -1 | 1
): string[] | null {
  const current = sortChildren(
    parentId,
    childIds.map((id) => ({ id }))
  ).map((c) => c.id);
  const i = current.indexOf(childId);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= current.length) return null;
  const next = [...current];
  const tmp = next[i];
  next[i] = next[j];
  next[j] = tmp;
  state = { ...state, [parentId]: next };
  save(state);
  notify();
  return next;
}
