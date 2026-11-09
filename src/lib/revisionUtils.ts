/**
 * Revision helpers — unversioned working state + integer versions after Version 1.
 *
 * - New / unestablished entities use UNVERSIONED (or empty / legacy letter with no history).
 * - User explicitly establishes Version 1.
 * - Subsequent versions are integer increments (1 → 2 → 3 …).
 * - Letter sequences remain supported only for already-bumped legacy data.
 */
import type { ReleaseStatus, ResourceEntity, RevisionRecord } from '../types/plm';

export const UNVERSIONED = 'Unversioned';

/** True when the entity has not yet been given a formal integer version. */
export function isUnversioned(revision: string | undefined | null): boolean {
  const s = (revision || '').trim();
  if (!s || s === UNVERSIONED || s === 'WIP') return true;
  // Legacy seed default "A" with no formal history is treated as unversioned
  // so the user can establish Version 1. Once a numeric version exists, this is false.
  return false;
}

/** True when revision is a simple integer version (1, 2, 3 …). */
export function isFormalVersion(revision: string | undefined | null): boolean {
  const s = (revision || '').trim();
  return /^\d+$/.test(s);
}

/**
 * Next formal version.
 * - Unversioned / empty / non-numeric → "1"
 * - Integer N → N+1
 * - Legacy letter (A, B, …) → next letter (only if already in letter sequence)
 */
export function nextRevision(current: string): string {
  const s = (current || '').trim();

  // Integer versions increment
  if (/^\d+$/.test(s)) {
    return String(Number(s) + 1);
  }

  // Dotted numeric kept for compatibility (1.0 → 1.1)
  if (/^\d+\.\d+$/.test(s)) {
    const [maj, min] = s.split('.');
    return `${maj}.${Number(min) + 1}`;
  }

  // Everything else (Unversioned, WIP, legacy letters A/B/C, empty) → Version 1
  return '1';
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
