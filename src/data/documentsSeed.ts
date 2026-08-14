/**
 * Phase 0 — Sample Document / Attachment seed data
 * Linked to TAR™ structural entities. Real upload → S3 comes with Amplify storage.
 */
import type { Document, ReleaseStatus } from '../types/plm';

const now = new Date().toISOString();

function doc(
  partial: Omit<Document, 'type' | 'createdAt' | 'lastModified' | 'status' | 'revision'> & {
    status?: ReleaseStatus;
    revision?: string;
    lastModified?: string;
  }
): Document {
  return {
    type: 'Document',
    status: 'Draft',
    revision: 'A',
    createdAt: now,
    lastModified: partial.lastModified ?? now,
    modifiedBy: 'Zedekiah',
    classification: 'CUI',
    ...partial,
  };
}

/**
 * Sample documents. attachmentIds on entities reference these ids.
 * url is a placeholder — Phase 0 UI shows metadata only.
 */
export const DOCUMENTS: Document[] = [
  doc({
    id: 'doc-opt-form-factor-spec',
    name: 'Optical Package Form-Factor Spec',
    kind: 'spec',
    description: 'Mechanical envelope, keep-out zones, and mass budget for sensor / optic stack.',
    fileName: 'TAR-OPT-FF-SPEC-A.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 482_000,
    linkedEntityIds: ['comp-opt-form-factor', 'sub-optical'],
    status: 'In Review',
    revision: 'A',
  }),
  doc({
    id: 'doc-ba-mount-drawing',
    name: 'Barrel Actuation Chassis Mount Drawing',
    kind: 'drawing',
    description: 'Interface control drawing for actuator-to-chassis mount.',
    fileName: 'TAR-BA-MOUNT-ICD-A.dwg',
    mimeType: 'application/acad',
    sizeBytes: 1_240_000,
    linkedEntityIds: ['comp-ba-mount', 'sub-barrel-actuation'],
    status: 'Draft',
    revision: 'A',
  }),
  doc({
    id: 'doc-scope-zero-proc',
    name: 'Scope Zeroing & Retention Procedure',
    kind: 'procedure',
    description: 'Field and shop zero procedures; retention check under recoil.',
    fileName: 'TAR-SCOPE-ZERO-PROC-A.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 210_000,
    linkedEntityIds: ['comp-scope-zero', 'sub-scope'],
    status: 'Released',
    revision: 'A',
  }),
  doc({
    id: 'doc-mv-pipeline-arch',
    name: 'Vision Pipeline Architecture Note',
    kind: 'analysis',
    description: 'Latency budget, detection stages, and output interface to fusion.',
    fileName: 'TAR-MV-ARCH-A.md',
    mimeType: 'text/markdown',
    sizeBytes: 48_000,
    linkedEntityIds: ['sw-mv-pipeline', 'sub-machine-vision'],
    status: 'Draft',
    revision: 'A',
  }),
  doc({
    id: 'doc-sys-tar-overview',
    name: 'TAR™ System Overview Brief',
    kind: 'other',
    description: 'Top-level system concept and subsystem responsibilities.',
    fileName: 'TAR-SYS-OVERVIEW-A.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 890_000,
    linkedEntityIds: ['sys-tar'],
    status: 'In Review',
    revision: '0.9',
  }),
  doc({
    id: 'doc-cl-control-law',
    name: 'Closed-Loop Control Law Description',
    kind: 'spec',
    description: 'Control objectives, sensors used, and actuation command rates.',
    fileName: 'TAR-CL-LAW-A.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 156_000,
    linkedEntityIds: ['sw-cl-controller', 'sub-closed-loop'],
    status: 'Draft',
    revision: 'A',
  }),
];

/** Lookup by document id */
export const DOCUMENTS_BY_ID: Record<string, Document> = Object.fromEntries(
  DOCUMENTS.map((d) => [d.id, d])
);

/** Documents linked to a given structural entity id */
export function documentsForEntity(entityId: string): Document[] {
  return DOCUMENTS.filter((d) => d.linkedEntityIds.includes(entityId));
}