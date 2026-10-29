import { defineStorage } from '@aws-amplify/backend';

/**
 * Vector PLM — document binaries + platform 3D models (ITAR-adjacent)
 * Authenticated only. No guest access.
 * Keys:
 *   documents/{documentId}/{fileName}
 *   models/{platform}.glb   (tar.glb, star.glb, mtar.glb, …)
 */
export const storage = defineStorage({
  name: 'vectorPlmDocuments',
  access: (allow) => ({
    'documents/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'models/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
