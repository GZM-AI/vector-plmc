import { defineStorage } from '@aws-amplify/backend';

/**
 * Vector PLM — document binaries + platform 3D models (ITAR-adjacent)
 * Authenticated only. No guest access.
 * Keys:
 *   models/attachments/{documentId}/{fileName}  (live role allows models/*)
 *   documents/{documentId}/{fileName}           (after auth-role policy includes it)
 *   models/{platform}.glb
 */
export const storage = defineStorage({
  name: 'vectorPlmDocuments',
  access: (allow) => ({
    'documents/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'models/attachments/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'models/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
