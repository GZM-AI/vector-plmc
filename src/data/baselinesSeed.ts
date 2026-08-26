/**
 * Phase 1 — Named configuration baselines (frozen entity revision maps).
 * Seed list is empty on purpose: demo baselines are not official TAR™ configurations.
 */
import type { Baseline } from '../types/plm';
import { ALL_ENTITIES } from './tarSeedData';

/** Current-tree snapshot helper for “create baseline from now” */
export function currentRevisionMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of ALL_ENTITIES) {
    map[e.id] = e.revision;
  }
  return map;
}

/** No official baselines until the team creates one from real content. */
export const SEED_BASELINES: Baseline[] = [];