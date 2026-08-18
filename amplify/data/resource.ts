import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  /**
   * Shared System Architecture hotspot layout for all Vector users.
   * One row per layoutKey (e.g. tar-system-architecture-v1).
   */
  MapLayout: a
    .model({
      layoutKey: a.string().required(),
      hotspotsJson: a.string().required(),
      updatedBy: a.string(),
    })
    .identifier(['layoutKey'])
    .authorization((allow) => [
      // Interim: authenticated users can read/write shared layout.
      // Guest/public can be added later if you need fully open read.
      allow.authenticated().to(['read', 'create', 'update']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});