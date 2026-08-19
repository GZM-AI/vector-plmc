import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  MapLayout: a
    .model({
      layoutKey: a.string().required(),
      hotspotsJson: a.string().required(),
      updatedBy: a.string(),
    })
    .identifier(['layoutKey'])
    .authorization((allow) => [
      // Works without sign-in (current Vector behavior)
      allow.guest().to(['read', 'create', 'update']),
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    // Guest uses IAM unauthenticated identity
    defaultAuthorizationMode: 'identityPool',
  },
});