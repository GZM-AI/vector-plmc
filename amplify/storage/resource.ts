import { defineStorage } from '@aws-amplify/backend';

/**
 * Vector PLM — document binaries (ITAR-adjacent)
 * Authenticated only. No guest access.
 * Keys: documents/{documentId}/{fileName}
 */
export const storage = defineStorage({
  name: 'vectorPlmDocuments',
  access: (allow) => ({
    'documents/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});