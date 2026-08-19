/**
 * Phase 1 — Named configuration baselines (frozen entity revision maps).
 */
import type { Baseline } from '../types/plm';
import { ALL_ENTITIES } from './tarSeedData';

function mapFrom(pairs: [string, string][]): Record<string, string> {
  return Object.fromEntries(pairs);
}

/** Current-tree snapshot helper for “create baseline from now” */
export function currentRevisionMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of ALL_ENTITIES) {
    map[e.id] = e.revision;
  }
  return map;
}

export const SEED_BASELINES: Baseline[] = [
  {
    id: 'bl-alpha-1',
    type: 'Baseline',
    name: 'Alpha Integration Build 1',
    description:
      'First integration baseline after Scope + Pixel-to-Position were added to the hierarchy.',
    createdAt: '2026-08-02T17:00:00.000Z',
    createdBy: 'Zedekiah',
    status: 'In Review',
    entityRevisions: mapFrom([
      ['sys-tar', '0.9'],
      ['sub-scope', 'A'],
      ['sub-optical', 'A'],
      ['comp-opt-form-factor', 'A'],
      ['comp-scope-zero', 'A'],
      ['sub-barrel-actuation', 'A'],
      ['comp-ba-mount', 'A'],
      ['sw-mv-pipeline', 'A'],
      ['sw-cl-controller', 'A'],
    ]),
  },
  {
    id: 'bl-shop-zero',
    type: 'Baseline',
    name: 'Shop Zero Package',
    description: 'Released zeroing procedure package for bench and field.',
    createdAt: '2026-07-08T12:00:00.000Z',
    createdBy: 'Zedekiah',
    status: 'Released',
    entityRevisions: mapFrom([
      ['sub-scope', 'A'],
      ['comp-scope-optic', 'A'],
      ['comp-scope-mount', 'A'],
      ['comp-scope-zero', 'A'],
    ]),
  },
];
