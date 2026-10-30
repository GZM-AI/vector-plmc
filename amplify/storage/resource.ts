import { defineStorage } from '@aws-amplify/backend';

/**
 * Vector PLM — document binaries + platform 3D models (ITAR-adjacent)
 * Authenticated only. No guest access.
 * Keys:
 *   attachments/{documentId}/{fileName}   card uploads (not models)
 *   documents/{documentId}/{fileName}     legacy path
 *   models/{platform}.glb                 platform 3D only
 */
export const storage = defineStorage({
  name: 'vectorPlmDocuments',
  access: (allow) => ({
    'attachments/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'documents/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'models/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
