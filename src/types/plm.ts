/**
 * Vector PLM — Phase 0 Entity Model
 * Formal TypeScript interfaces for TAR™ product structure + configuration management foundation.
 *
 * Sequencing: Phase 0 (this file) → Phase 1 (revision history / baselines) → Phase 2 (ChangeRequest workflow)
 *
 * Design principles:
 * - Single source of truth hierarchy remains the navigation spine (System → Subsystems → children)
 * - Every product entity carries revision + release status + audit fields
 * - Documents attach to any entity without altering System Architecture UX
 */

// ─── Enumerations ───────────────────────────────────────────────────────────

/** Configuration / release status (core PLM field — handoff Phase 0) */
export type ReleaseStatus = 'Draft' | 'In Review' | 'Released' | 'Obsolete';

/**
 * Product maturity / development stage (optional; preserves prior seed semantics).
 * Distinct from release status so a Released part can still be "prototype" maturity.
 */
export type LifecycleStage =
  | 'concept'
  | 'in-design'
  | 'prototype'
  | 'qualified'
  | 'production'
  | 'obsolete';

/** Structural entity kinds in the product hierarchy */
export type StructuralEntityType =
  | 'System'
  | 'Subsystem'
  | 'Component'
  | 'SoftwareItem'
  | 'Interface'
  | 'Capability'; // Vertical Integrators node (per-subsystem)

/** Full set of PLM object types (Phase 0 + forward-looking) */
export type PlmEntityType =
  | StructuralEntityType
  | 'Document'
  | 'Requirement'
  | 'TestCase'
  | 'TestResult'
  | 'BOMLine'
  | 'ChangeRequest'
  | 'RevisionRecord'
  | 'Baseline';

export type Classification = 'UNCLASSIFIED' | 'CUI' | 'ITAR' | 'SECRET';

export type DocumentKind =
  | 'spec'
  | 'drawing'
  | 'cad'
  | 'test-report'
  | 'photo'
  | 'analysis'
  | 'procedure'
  | 'other';

export type ChangeRequestStatus =
  | 'Draft'
  | 'In Review'
  | 'Approved'
  | 'Implemented'
  | 'Closed'
  | 'Rejected';

export type RequirementPriority = 'must' | 'should' | 'could' | 'wont';
export type CoverageStatus = 'uncovered' | 'partial' | 'covered' | 'verified';

// ─── Shared audit / revision mixins ─────────────────────────────────────────

/** Required on every product entity (Phase 0 success criterion) */
export interface RevisionFields {
  /** Human-readable revision identifier (e.g. "A", "B", "0.9", "1.0") */
  revision: string;
  /** Configuration / release state */
  status: ReleaseStatus;
  /** ISO-8601 last modification timestamp */
  lastModified: string;
  /** Display name or user id of last editor */
  modifiedBy?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface ClassificationFields {
  classification?: Classification;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

// ─── Document / Attachment ──────────────────────────────────────────────────

/**
 * Document is a first-class PLM object. Attachments are links from any entity
 * to a Document (many-to-many via entity.attachmentIds ↔ document.linkedEntityIds).
 * Phase 0: metadata + mock URLs only (no real S3 upload yet).
 */
export interface Document extends RevisionFields, ClassificationFields {
  id: string;
  name: string;
  type: 'Document';
  kind: DocumentKind;
  description?: string;
  /** MIME type if known */
  mimeType?: string;
  /** File size in bytes (optional) */
  sizeBytes?: number;
  /** Placeholder or future S3/AppSync URL */
  url?: string;
  /** Entities this document is linked to */
  linkedEntityIds: string[];
  /** Optional original filename */
  fileName?: string;
}

/** Lightweight attachment summary for UI lists */
export interface AttachmentRef {
  documentId: string;
  name: string;
  kind: DocumentKind;
  revision: string;
  status: ReleaseStatus;
  lastModified: string;
  url?: string;
}

// ─── Structural product entities ────────────────────────────────────────────

/**
 * Canonical hierarchical product entity (System → Subsystem → Component / SW / Interface / VI).
 * Extends prior ResourceEntity with Phase 0 revision + attachment support.
 */
export interface ResourceEntity extends RevisionFields, ClassificationFields {
  id: string;
  name: string;
  type: StructuralEntityType;
  description?: string;
  owner?: string;
  parentId: string | null;
  children?: ResourceEntity[];
  relatedIds?: string[];
  /** Linked Document ids (Phase 0 attachments) */
  attachmentIds?: string[];
  /**
   * Optional product maturity stage (legacy seed values).
   * Prefer `status` (ReleaseStatus) for configuration management.
   */
  lifecycleStage?: LifecycleStage;
}

// ─── Forward-looking Phase 1–3 shapes (interfaces only) ─────────────────────

/** Immutable revision history entry (Phase 1) */
export interface RevisionRecord {
  id: string;
  type: 'RevisionRecord';
  entityId: string;
  revision: string;
  status: ReleaseStatus;
  changedAt: string;
  changedBy?: string;
  comment?: string;
  /** Optional field-level diff summary */
  changesSummary?: string;
}

/** Named configuration snapshot (Phase 1) */
export interface Baseline {
  id: string;
  type: 'Baseline';
  name: string;
  description?: string;
  createdAt: string;
  createdBy?: string;
  /** Map of entityId → revision at freeze time */
  entityRevisions: Record<string, string>;
  status: ReleaseStatus;
}

/** Change Request / ECR-ECO (Phase 2) */
export interface ChangeRequest extends RevisionFields, ClassificationFields {
  id: string;
  type: 'ChangeRequest';
  title: string;
  summary: string;
  changeStatus: ChangeRequestStatus;
  impact?: 'low' | 'medium' | 'high';
  affectedEntityIds: string[];
  requestedBy?: string;
  approvers?: string[];
  /** Immutable audit events appended over time */
  auditTrail?: AuditEvent[];
}

export interface AuditEvent {
  at: string;
  by?: string;
  action: string;
  detail?: string;
}

/** Requirement object (Phase 3 start) */
export interface Requirement extends RevisionFields, ClassificationFields {
  id: string;
  type: 'Requirement';
  title: string;
  statement: string;
  priority?: RequirementPriority;
  parentRequirementId?: string | null;
  /** Linked design entities */
  linkedEntityIds: string[];
  coverageStatus?: CoverageStatus;
}

export interface TestCase extends RevisionFields, ClassificationFields {
  id: string;
  type: 'TestCase';
  title: string;
  procedure?: string;
  linkedRequirementIds?: string[];
  linkedEntityIds?: string[];
}

export interface TestResult {
  id: string;
  type: 'TestResult';
  testCaseId: string;
  executedAt: string;
  executedBy?: string;
  outcome: 'pass' | 'fail' | 'blocked' | 'skipped';
  notes?: string;
  evidenceDocumentIds?: string[];
}

/** Multi-level BOM line (Phase 4) */
export interface BOMLine extends RevisionFields {
  id: string;
  type: 'BOMLine';
  parentEntityId: string;
  childEntityId: string;
  quantity: number;
  unit?: string;
  refDes?: string;
  notes?: string;
  substituteEntityIds?: string[];
}

// ─── Amplify / persistence helpers (sketch) ─────────────────────────────────

/** Flat record shape suitable for Amplify Data / DynamoDB (no nested children) */
export interface EntityRecord extends Omit<ResourceEntity, 'children'> {
  /** Parent id only; tree is reconstructed client-side or via GSI */
  parentId: string | null;
}

export const RELEASE_STATUS_ORDER: ReleaseStatus[] = [
  'Draft',
  'In Review',
  'Released',
  'Obsolete',
];

export const DEFAULT_REVISION = 'A';
export const DEFAULT_RELEASE_STATUS: ReleaseStatus = 'Draft';
