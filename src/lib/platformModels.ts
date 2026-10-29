/**
 * Platform 3D models — Amplify Storage
 *
 * Keys: models/{platform}.glb
 *   tar.glb, star.glb, mtar.glb
 *
 * Authenticated only (same Cognito pool as the rest of Vector).
 * Returns a short-lived signed URL suitable for useGLTF / <model-viewer>.
 */
import { getUrl, uploadData } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';

export type PlatformModelKey = 'tar' | 'star' | 'mtar';

const PLATFORM_FILE: Record<string, PlatformModelKey> = {
  'sys-tar': 'tar',
  'sys-star': 'star',
  'sys-mtar': 'mtar',
};

export function platformModelKey(platformId: string | undefined | null): PlatformModelKey | null {
  if (!platformId) return null;
  return PLATFORM_FILE[platformId] ?? null;
}

export function platformModelStoragePath(key: PlatformModelKey): string {
  return `models/${key}.glb`;
}

async function signedIn(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

/**
 * Signed URL for a platform model, or null if missing / not signed in.
 * expiresIn is seconds (default 1 hour).
 */
export async function getPlatformModelUrl(
  platformId: string | undefined | null,
  expiresIn = 3600
): Promise<string | null> {
  const key = platformModelKey(platformId);
  if (!key) return null;
  if (!(await signedIn())) return null;

  const path = platformModelStoragePath(key);
  try {
    const { url } = await getUrl({
      path,
      options: { expiresIn },
    });
    return url.toString();
  } catch {
    // Fallback for older Amplify Storage API shapes
    try {
      const { url } = await getUrl({
        path,
        options: { expiresIn },
      } as never);
      return url.toString();
    } catch {
      return null;
    }
  }
}

/**
 * Upload (or replace) a platform GLB.
 * Call this once from a console or a small admin control; then the viewer picks it up.
 */
export async function uploadPlatformModel(
  platformId: string,
  file: File
): Promise<string> {
  const key = platformModelKey(platformId);
  if (!key) throw new Error(`Unknown platform for model upload: ${platformId}`);
  if (!(await signedIn())) throw new Error('Sign in required to upload models.');

  const path = platformModelStoragePath(key);
  await uploadData({
    path,
    data: file,
    options: { contentType: file.type || 'model/gltf-binary' },
  }).result;
  return path;
}
