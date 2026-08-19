/**
 * Phase 1 — Seed revision history for key TAR™ entities.
 * Additional records are appended at runtime via configStore (localStorage).
 */
import type { RevisionRecord } from '../types/plm';

const d = (iso: string) => iso;

/** Immutable seed history (oldest → newest within each entity) */
export const SEED_REVISION_HISTORY: RevisionRecord[] = [
  // TAR system
  {
    id: 'rh-sys-tar-08',
    type: 'RevisionRecord',
    entityId: 'sys-tar',
    revision: '0.8',
    status: 'Draft',
    changedAt: d('2026-06-12T15:00:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Initial system architecture freeze for concept review.',
    changesSummary: 'Hierarchy established; 10 subsystems defined.',
  },
  {
    id: 'rh-sys-tar-09',
    type: 'RevisionRecord',
    entityId: 'sys-tar',
    revision: '0.9',
    status: 'In Review',
    changedAt: d('2026-08-01T18:30:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Added Scope and Pixel-to-Position subsystems.',
    changesSummary: 'Subsystem count 10 → 12; system overview brief linked.',
  },

  // Form factor design
  {
    id: 'rh-comp-opt-ff-a',
    type: 'RevisionRecord',
    entityId: 'comp-opt-form-factor',
    revision: 'A',
    status: 'In Review',
    changedAt: d('2026-07-22T14:10:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'First ICD envelope for sensor/optic stack.',
    changesSummary: 'Mass budget and keep-out zones drafted.',
  },

  // Scope zero
  {
    id: 'rh-comp-scope-zero-a',
    type: 'RevisionRecord',
    entityId: 'comp-scope-zero',
    revision: 'A',
    status: 'Released',
    changedAt: d('2026-07-08T11:00:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Zeroing procedure released for shop use.',
    changesSummary: 'Field and bench procedures; retention check under recoil.',
  },

  // Barrel mount
  {
    id: 'rh-comp-ba-mount-a',
    type: 'RevisionRecord',
    entityId: 'comp-ba-mount',
    revision: 'A',
    status: 'Draft',
    changedAt: d('2026-08-05T16:45:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Chassis mount interface opened for two-axis loads.',
    changesSummary: 'ICD geometry placeholder; waiting structural FEA.',
  },

  // Vision pipeline
  {
    id: 'rh-sw-mv-pipeline-a',
    type: 'RevisionRecord',
    entityId: 'sw-mv-pipeline',
    revision: 'A',
    status: 'Draft',
    changedAt: d('2026-07-30T09:20:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Architecture note for detection latency budget.',
    changesSummary: 'Pipeline stages and fusion handoff defined.',
  },

  // Closed-loop controller
  {
    id: 'rh-sw-cl-controller-a',
    type: 'RevisionRecord',
    entityId: 'sw-cl-controller',
    revision: 'A',
    status: 'Draft',
    changedAt: d('2026-08-03T13:00:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Control law description opened.',
    changesSummary: 'Objectives, sensors, command rates sketched.',
  },

  // Sensor integration subsystem
  {
    id: 'rh-sub-optical-a',
    type: 'RevisionRecord',
    entityId: 'sub-optical',
    revision: 'A',
    status: 'Draft',
    changedAt: d('2026-06-20T10:00:00.000Z'),
    changedBy: 'Zedekiah',
    comment: 'Subsystem node created under TAR™.',
  },
];

export function historyForEntity(
  entityId: string,
  extra: RevisionRecord[] = []
): RevisionRecord[] {
  return [...SEED_REVISION_HISTORY, ...extra]
    .filter((r) => r.entityId === entityId)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
}
