/**
 * Shared Hotspot Layout Store — aligned to amplify MapLayout model
 * layoutKey: "tar-system-architecture-v1"
 * Load: cloud → local cache → DEFAULT_HOTSPOTS
 * Save: explicit publish (Save layout button)
 */

export type Hotspot = {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
};

export const DEFAULT_HOTSPOTS: Hotspot[] = [
  { id: 'sub-scope', label: 'Scope', left: 40, top: 6, width: 12, height: 12, color: '#f43f5e' },
  { id: 'sub-optical', label: 'Sensor Integration', left: 38, top: 14, width: 14, height: 18, color: '#22c55e' },
  { id: 'sub-machine-vision', label: 'Machine Vision', left: 42, top: 20, width: 12, height: 14, color: '#0ea5e9' },
  { id: 'sub-sensor-fusion', label: 'Sensor Fusion', left: 32, top: 30, width: 12, height: 22, color: '#f97316' },
  { id: 'sub-ballistics', label: 'Ballistic Computation', left: 34, top: 38, width: 12, height: 20, color: '#d946ef' },
  { id: 'sub-pixel-to-position', label: 'Pixel to Position', left: 50, top: 22, width: 14, height: 12, color: '#14b8a6' },
  { id: 'sub-barrel-actuation', label: 'Barrel Actuation', left: 52, top: 28, width: 34, height: 26, color: '#ef4444' },
  { id: 'sub-chassis', label: 'Chassis', left: 10, top: 42, width: 16, height: 26, color: '#a3e635' },
  { id: 'sub-receiver', label: 'Receiver Configuration', left: 30, top: 32, width: 14, height: 24, color: '#06b6d4' },
  { id: 'sub-trigger', label: 'Trigger', left: 26, top: 48, width: 10, height: 14, color: '#fbbf24' },
  { id: 'sub-power', label: 'Power', left: 28, top: 54, width: 12, height: 16, color: '#f8fafc' },
  { id: 'sub-closed-loop', label: 'Closed Loop', left: 28, top: 34, width: 12, height: 22, color: '#6366f1' },
];

const LOCAL_CACHE_KEY = 'vector-tar-hotspots-v3';
export const LAYOUT_RECORD_KEY = 'tar-system-architecture-v1';

function mergeWithDefaults(partial: Partial<Hotspot>[]): Hotspot[] {
  const byId = Object.fromEntries(
    partial.filter((h) => h && h.id).map((h) => [h.id as string, h])
  );
  return DEFAULT_HOTSPOTS.map((d) => ({
    ...d,
    left: byId[d.id]?.left ?? d.left,
    top: byId[d.id]?.top ?? d.top,
    width: byId[d.id]?.width ?? d.width,
    height: byId[d.id]?.height ?? d.height,
  }));
}

function readLocalCache(): Hotspot[] | null {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Hotspot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return mergeWithDefaults(parsed);
  } catch {
    return null;
  }
}

function writeLocalCache(hotspots: Hotspot[]): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(hotspots));
  } catch {
    /* ignore */
  }
}

/** Amplify Gen 2 client shape for MapLayout */
type AmplifyLikeClient = {
  models: {
    MapLayout: {
      get: (args: {
        layoutKey: string;
      }) => Promise<{ data?: { hotspotsJson?: string; layoutKey?: string } | null }>;
      update: (args: {
        layoutKey: string;
        hotspotsJson: string;
        updatedBy?: string;
      }) => Promise<unknown>;
      create: (args: {
        layoutKey: string;
        hotspotsJson: string;
        updatedBy?: string;
      }) => Promise<unknown>;
    };
  };
};

let amplifyClient: AmplifyLikeClient | null = null;

export function configureHotspotAmplify(client: AmplifyLikeClient | null): void {
  amplifyClient = client;
}

async function readFromCloud(): Promise<Hotspot[] | null> {
  if (!amplifyClient) return null;
  try {
    const result = await amplifyClient.models.MapLayout.get({
      layoutKey: LAYOUT_RECORD_KEY,
    });
    const json = result?.data?.hotspotsJson;
    if (!json) return null;
    const parsed = JSON.parse(json) as Hotspot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return mergeWithDefaults(parsed);
  } catch {
    return null;
  }
}

async function writeToCloud(hotspots: Hotspot[], updatedBy?: string): Promise<boolean> {
  if (!amplifyClient) {
    console.warn('[hotspotLayout] no Amplify client — configureHotspotAmplify was not called');
    return false;
  }
  const payload = {
    layoutKey: LAYOUT_RECORD_KEY,
    hotspotsJson: JSON.stringify(hotspots),
    updatedBy: updatedBy || 'unknown',
  };
  try {
    try {
      await amplifyClient.models.MapLayout.update(payload);
      console.log('[hotspotLayout] cloud UPDATE ok');
      return true;
    } catch (updateErr) {
      console.warn('[hotspotLayout] UPDATE failed, trying CREATE', updateErr);
      await amplifyClient.models.MapLayout.create(payload);
      console.log('[hotspotLayout] cloud CREATE ok');
      return true;
    }
  } catch (err) {
    console.error('[hotspotLayout] cloud write failed', err);
    return false;
  }
}

export type LoadResult = {
  hotspots: Hotspot[];
  source: 'cloud' | 'local' | 'default';
};

export async function loadHotspotLayout(): Promise<LoadResult> {
  const cloud = await readFromCloud();
  if (cloud) {
    writeLocalCache(cloud);
    return { hotspots: cloud, source: 'cloud' };
  }
  const local = readLocalCache();
  if (local) return { hotspots: local, source: 'local' };
  return { hotspots: DEFAULT_HOTSPOTS.map((h) => ({ ...h })), source: 'default' };
}

export async function saveHotspotLayout(
  hotspots: Hotspot[],
  updatedBy?: string
): Promise<{ cloudSaved: boolean }> {
  writeLocalCache(hotspots);
  const cloudSaved = await writeToCloud(hotspots, updatedBy);
  return { cloudSaved };
}

export function resetHotspotLayoutLocal(): Hotspot[] {
  try {
    localStorage.removeItem(LOCAL_CACHE_KEY);
  } catch {
    /* ignore */
  }
  return DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
}