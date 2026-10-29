/**
 * Platform 3D models — Amplify Storage
 *
 * Keys: models/{platform}.glb
 *   tar.glb, star.glb, mtar.glb
 *
 * Authenticated only (same Cognito pool as the rest of Vector).
 * Returns a short-lived signed URL suitable for useGLTF.
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

export type PlatformModelResult = {
  url: string | null;
  path: string | null;
  reason: string | null;
};

/**
 * Signed URL for a platform model.
 * Always returns a reason when url is null so the UI can explain the failure.
 */
export async function getPlatformModelUrl(
  platformId: string | undefined | null,
  expiresIn = 3600
): Promise<PlatformModelResult> {
  const key = platformModelKey(platformId);
  if (!key) {
    return { url: null, path: null, reason: `No model mapping for platform ${platformId || '(none)'}` };
  }
  const path = platformModelStoragePath(key);

  if (!(await signedIn())) {
    return { url: null, path, reason: 'Sign in required to load models from Amplify Storage.' };
  }

  try {
    const { url } = await getUrl({
      path,
      options: { expiresIn },
    });
    return { url: url.toString(), path, reason: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Retry once with a slightly different call shape in case of API variance
    try {
      const { url } = await getUrl({
        path,
        options: { expiresIn, validateObjectExistence: false },
      } as never);
      return { url: url.toString(), path, reason: null };
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2);
      return {
        url: null,
        path,
        reason: `Storage lookup failed for ${path}: ${msg2 || msg}`,
      };
    }
  }
}

/**
 * Upload (or replace) a platform GLB.
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
