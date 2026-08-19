/**
 * Phase 1 — Revision helpers
 * Supports letter sequence (A→B→…→Z→AA) and dotted numeric (0.9→1.0→1.1).
 */
import type { ReleaseStatus, ResourceEntity, RevisionRecord } from '../types/plm';

/** Bump a revision string to the next value */
export function nextRevision(current: string): string {
  const s = (current || 'A').trim();

  // Dotted numeric: 0.9 → 1.0, 1.0 → 1.1, 1.2 → 1.3
  if (/^\d+(\.\d+)?$/.test(s)) {
    const parts = s.split('.');
    if (parts.length === 1) {
      return String(Number(parts[0]) + 1);
    }
    const major = Number(parts[0]);
    const minor = Number(parts[1]);
    // Prefer minor bump for integration-style revs
    return `${major}.${minor + 1}`;
  }

  // Letter sequence: A → B … Z → AA → AB
  const upper = s.toUpperCase();
  if (/^[A-Z]+$/.test(upper)) {
    const chars = upper.split('');
    let i = chars.length - 1;
    while (i >= 0) {
      if (chars[i] !== 'Z') {
        chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
        return chars.join('');
      }
      chars[i] = 'A';
      i -= 1;
    }
    return 'A' + chars.join('');
  }

  // Fallback: append .1
  return `${s}.1`;
}

export function makeRevisionRecord(input: {
  entityId: string;
  revision: string;
  status: ReleaseStatus;
  changedBy?: string;
  comment?: string;
  changesSummary?: string;
}): RevisionRecord {
  return {
    id: `rev-${input.entityId}-${input.revision}-${Date.now()}`,
    type: 'RevisionRecord',
    entityId: input.entityId,
    revision: input.revision,
    status: input.status,
    changedAt: new Date().toISOString(),
    changedBy: input.changedBy ?? 'Zedekiah',
    comment: input.comment,
    changesSummary: input.changesSummary,
  };
}

/** Snapshot map of entityId → current revision for baseline freeze */
export function snapshotEntityRevisions(entities: ResourceEntity[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of entities) {
    map[e.id] = e.revision;
  }
  return map;
}

export function sortHistoryNewestFirst(records: RevisionRecord[]): RevisionRecord[] {
  return [...records].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );
}
