import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Vector PLM — Amplify Data
 * MapLayout + Registry spine + Change Control + Documents + Suppliers
 *
 * Document model: authenticated only (no publicApiKey).
 * Other models keep publicApiKey for current team workflow.
 */
const schema = a.schema({
  MapLayout: a
    .model({
      layoutKey: a.string().required(),
      hotspotsJson: a.string().required(),
      updatedBy: a.string(),
    })
    .identifier(['layoutKey'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Per-entity field + revision overlay (seed entityId) */
  ProductOverlay: a
    .model({
      entityId: a.string().required(),
      revision: a.string().required(),
      status: a.string().required(),
      name: a.string(),
      description: a.string(),
      notes: a.string(),
      modifiedBy: a.string(),
      lastModified: a.string().required(),
    })
    .identifier(['entityId'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** User-added Registry children (Add child) */
  ExtraEntity: a
    .model({
      id: a.string().required(),
      parentId: a.string().required(),
      name: a.string().required(),
      type: a.string().required(),
      description: a.string(),
      revision: a.string().required(),
      status: a.string().required(),
      modifiedBy: a.string(),
      lastModified: a.string().required(),
      createdAt: a.string().required(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Immutable revision history rows */
  RevisionEvent: a
    .model({
      id: a.string().required(),
      entityId: a.string().required(),
      revision: a.string().required(),
      status: a.string().required(),
      comment: a.string(),
      changesSummary: a.string(),
      changedBy: a.string(),
      changedAt: a.string().required(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Named baseline snapshots */
  BaselineRecord: a
    .model({
      id: a.string().required(),
      name: a.string().required(),
      description: a.string(),
      status: a.string().required(),
      entityRevisionsJson: a.string().required(),
      createdBy: a.string(),
      createdAt: a.string().required(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /**
   * Change Request (ECR/ECO)
   * Status: Draft → Submitted → In Review → Approved|Rejected → Implemented → Closed
   */
  ChangeRequest: a
    .model({
      id: a.string().required(),
      title: a.string().required(),
      summary: a.string(),
      changeStatus: a.string().required(),
      impact: a.string(),
      affectedEntityIdsJson: a.string().required(),
      requestedBy: a.string(),
      approversJson: a.string(),
      linkedRevisionEventIdsJson: a.string(),
      createdAt: a.string().required(),
      lastModified: a.string().required(),
      modifiedBy: a.string(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Immutable audit events for a Change Request (append-only) */
  ChangeAuditEvent: a
    .model({
      id: a.string().required(),
      changeRequestId: a.string().required(),
      at: a.string().required(),
      by: a.string(),
      action: a.string().required(),
      detail: a.string(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /**
   * Document metadata (ITAR-adjacent)
   * File bytes: Amplify Storage documents/{documentId}/{fileName}
   * Auth: authenticated only — no publicApiKey
   */
  Document: a
    .model({
      id: a.string().required(),
      name: a.string().required(),
      kind: a.string().required(),
      description: a.string(),
      mimeType: a.string(),
      sizeBytes: a.integer(),
      storageKey: a.string(),
      fileName: a.string(),
      revision: a.string().required(),
      status: a.string().required(),
      classification: a.string(),
      linkedEntityIdsJson: a.string().required(),
      createdAt: a.string().required(),
      lastModified: a.string().required(),
      modifiedBy: a.string(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Team-shared supplier / vendor / manufacturer / integrator */
  SupplierRecord: a
    .model({
      id: a.string().required(),
      name: a.string().required(),
      kind: a.string().required(),
      website: a.string(),
      contactName: a.string(),
      contactEmail: a.string(),
      contactPhone: a.string(),
      location: a.string(),
      engagement: a.string().required(),
      risk: a.string().required(),
      notes: a.string(),
      entityIdsJson: a.string().required(),
      subsystemIdsJson: a.string().required(),
      createdAt: a.string().required(),
      updatedAt: a.string().required(),
    })
    .identifier(['id'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),

  /** Per-Registry-entity make/buy overlay */
  EntitySourcingRecord: a
    .model({
      entityId: a.string().required(),
      makeBuy: a.string().required(),
      preferredSupplierId: a.string(),
      notes: a.string(),
      updatedAt: a.string().required(),
    })
    .identifier(['entityId'])
    .authorization((allow) => [
      allow.publicApiKey().to(['read', 'create', 'update', 'delete']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
