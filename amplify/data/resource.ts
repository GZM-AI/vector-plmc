import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Vector PLM — Amplify Data
 * MapLayout (zones) + Registry spine (overlays, extra entities, revisions, baselines)
 * API key auth for small trusted team (same as shared zone map).
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
