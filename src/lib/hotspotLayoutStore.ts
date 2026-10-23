/**
 * Per-platform Hotspot Layout Store
 * ---------------------------------
 * Team-wide System Architecture zone maps via Amplify Data MapLayout.
 * Each platform (TAR / S-TAR / M-TAR) has its own layoutKey and local cache.
 *
 * Model: MapLayout
 *   layoutKey: "tar-system-architecture-v1" | "star-system-architecture-v1" | "mtar-system-architecture-v1"
 *   hotspotsJson: JSON.stringify(Hotspot[])
 *   updatedBy?: string
 *
 * Load order: cloud → localStorage cache → platform defaults
 * Save: explicit "Save layout" only (draft while dragging)
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

export type PlatformIdLike = string;

const LAYOUT_KEYS: Record<string, string> = {
  'sys-tar': 'tar-system-architecture-v1',
  'sys-star': 'star-system-architecture-v1',
  'sys-mtar': 'mtar-system-architecture-v1',
};

export function getLayoutKey(platformId: PlatformIdLike): string {
  return LAYOUT_KEYS[platformId] || `layout-${platformId}-v1`;
}

function localCacheKey(platformId: PlatformIdLike): string {
  return `vector-tar-hotspots-v3-${platformId}`;
}

/** Bootstrap / Reset target for TAR (original shared layout). */
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

const PALETTE = [
  '#f43f5e',
  '#22c55e',
  '#0ea5e9',
  '#f97316',
  '#d946ef',
  '#14b8a6',
  '#ef4444',
  '#a3e635',
  '#06b6d4',
  '#fbbf24',
  '#f8fafc',
  '#6366f1',
];

/** Spread subsystems into a simple grid of default zones when no saved layout exists. */
export function buildDefaultHotspots(
  subsystems: { id: string; name: string }[],
  platformId?: PlatformIdLike
): Hotspot[] {
  if (platformId === 'sys-tar' || !platformId) {
    return DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
  }
  // S-TAR starts as a copy of TAR zone positions (independent ids). User adjusts from there.
  if (platformId === 'sys-star') {
    const byName = new Map(subsystems.map((s) => [s.name, s]));
    const copied = DEFAULT_HOTSPOTS.map((h) => {
      const match = byName.get(h.label) || subsystems.find((s) => s.id.endsWith(h.id));
      if (!match) return null;
      return { ...h, id: match.id, label: match.name };
    }).filter(Boolean) as Hotspot[];
    if (copied.length) return copied;
  }
  if (!subsystems.length) {
    return DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
  }
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(subsystems.length))));
  return subsystems.map((s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      id: s.id,
      label: s.name,
      left: 8 + col * 22,
      top: 10 + row * 28,
      width: 18,
      height: 20,
      color: PALETTE[i % PALETTE.length],
    };
  });
}

function mergeWithDefaults(partial: Partial<Hotspot>[], defaults: Hotspot[]): Hotspot[] {
  const byId = Object.fromEntries(
    partial.filter((h) => h && h.id).map((h) => [h.id as string, h])
  );
  // Prefer saved positions for known ids; append any new saved zones not in defaults
  const merged = defaults.map((d) => ({
    ...d,
    left: byId[d.id]?.left ?? d.left,
    top: byId[d.id]?.top ?? d.top,
    width: byId[d.id]?.width ?? d.width,
    height: byId[d.id]?.height ?? d.height,
    color: byId[d.id]?.color ?? d.color,
    label: byId[d.id]?.label ?? d.label,
  }));
  const known = new Set(defaults.map((d) => d.id));
  for (const h of partial) {
    if (h?.id && !known.has(h.id as string) && h.left != null) {
      merged.push({
        id: h.id as string,
        label: (h.label as string) || (h.id as string),
        left: h.left as number,
        top: (h.top as number) ?? 10,
        width: (h.width as number) ?? 16,
        height: (h.height as number) ?? 16,
        color: (h.color as string) || '#94a3b8',
      });
    }
  }
  return merged;
}

function readLocalCache(platformId: PlatformIdLike, defaults: Hotspot[]): Hotspot[] | null {
  try {
    const raw = localStorage.getItem(localCacheKey(platformId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Hotspot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return mergeWithDefaults(parsed, defaults);
  } catch {
    return null;
  }
}

function writeLocalCache(platformId: PlatformIdLike, hotspots: Hotspot[]): void {
  try {
    localStorage.setItem(localCacheKey(platformId), JSON.stringify(hotspots));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Amplify Gen 2 client shape for MapLayout */
type AmplifyLikeClient = {
  models: {
    MapLayout: {
      get: (args: {
        layoutKey: string;
      }) => Promise<{
        data?: { hotspotsJson?: string; layoutKey?: string } | null;
        errors?: unknown[];
      }>;
      update: (args: {
        layoutKey: string;
        hotspotsJson: string;
        updatedBy?: string;
      }) => Promise<{ data?: unknown; errors?: unknown[] }>;
      create: (args: {
        layoutKey: string;
        hotspotsJson: string;
        updatedBy?: string;
      }) => Promise<{ data?: unknown; errors?: unknown[] }>;
    };
  };
};

let amplifyClient: AmplifyLikeClient | null = null;

export function configureHotspotAmplify(client: AmplifyLikeClient | null): void {
  amplifyClient = client;
}

function hasErrors(result: { errors?: unknown[] } | null | undefined): boolean {
  return Array.isArray(result?.errors) && result!.errors!.length > 0;
}

async function readFromCloud(layoutKey: string, defaults: Hotspot[]): Promise<Hotspot[] | null> {
  if (!amplifyClient) {
    console.warn('[hotspotLayout] load: no client');
    return null;
  }
  try {
    const result = await amplifyClient.models.MapLayout.get({ layoutKey });
    console.log('[hotspotLayout] GET raw', layoutKey, result);

    if (hasErrors(result)) {
      console.error('[hotspotLayout] GET errors', result.errors);
      return null;
    }

    const json = result?.data?.hotspotsJson;
    if (!json) {
      console.warn('[hotspotLayout] GET: no row / no hotspotsJson', layoutKey);
      return null;
    }

    const parsed = JSON.parse(json) as Hotspot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    console.log('[hotspotLayout] load from CLOUD', layoutKey, parsed.length, 'zones');
    return mergeWithDefaults(parsed, defaults);
  } catch (err) {
    console.error('[hotspotLayout] GET failed', layoutKey, err);
    return null;
  }
}

async function writeToCloud(
  layoutKey: string,
  hotspots: Hotspot[],
  updatedBy?: string
): Promise<boolean> {
  if (!amplifyClient) {
    console.warn('[hotspotLayout] no Amplify client — configureHotspotAmplify was not called');
    return false;
  }

  const payload = {
    layoutKey,
    hotspotsJson: JSON.stringify(hotspots),
    updatedBy: updatedBy || 'unknown',
  };

  try {
    let result = await amplifyClient.models.MapLayout.update(payload);
    console.log('[hotspotLayout] UPDATE raw', layoutKey, result);

    if (hasErrors(result) || !result?.data) {
      console.warn('[hotspotLayout] UPDATE did not stick, trying CREATE', layoutKey);
      result = await amplifyClient.models.MapLayout.create(payload);
      console.log('[hotspotLayout] CREATE raw', layoutKey, result);

      if (hasErrors(result) || !result?.data) {
        console.error('[hotspotLayout] CREATE failed', result?.errors || result);
        return false;
      }
    }

    const verify = await amplifyClient.models.MapLayout.get({ layoutKey });
    console.log('[hotspotLayout] VERIFY GET', layoutKey, verify);

    if (hasErrors(verify) || !verify?.data?.hotspotsJson) {
      console.error('[hotspotLayout] write reported ok but GET empty', verify?.errors || verify);
      return false;
    }

    console.log('[hotspotLayout] cloud write verified', layoutKey);
    return true;
  } catch (err) {
    console.error('[hotspotLayout] cloud write failed', layoutKey, err);
    return false;
  }
}

export type LoadResult = {
  hotspots: Hotspot[];
  source: 'cloud' | 'local' | 'default';
};

/**
 * Load team layout for a platform: cloud → local cache → defaults.
 * Pass the active platform's subsystem list so non-TAR platforms get sensible defaults.
 */
function hasPlatformOverlap(hotspots: Hotspot[], subsystems: { id: string }[]): boolean {
  if (!subsystems.length) return true;
  const ids = new Set(subsystems.map((s) => s.id));
  return hotspots.some((h) => ids.has(h.id));
}


/** Remap TAR zone ids/titles onto S-TAR subsystem ids, keeping exact positions. */
export function remapTarLayoutToStar(
  tarHotspots: Hotspot[],
  starSubsystems: { id: string; name: string }[]
): Hotspot[] {
  const byName = new Map(starSubsystems.map((s) => [s.name, s]));
  const bySuffix = new Map(starSubsystems.map((s) => [s.id.replace(/^star-/, ''), s]));
  return tarHotspots.map((h) => {
    const match = byName.get(h.label) || bySuffix.get(h.id);
    if (!match) return null;
    return {
      ...h,
      id: match.id,
      label: match.name || h.label,
    };
  }).filter(Boolean) as Hotspot[];
}

function readLegacyTarCache(defaults: Hotspot[]): Hotspot[] | null {
  try {
    const raw = localStorage.getItem('vector-tar-hotspots-v3');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Hotspot[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return mergeWithDefaults(parsed, defaults);
  } catch {
    return null;
  }
}

async function loadTarLayoutRaw(): Promise<Hotspot[] | null> {
  const tarDefaults = DEFAULT_HOTSPOTS.map((h) => ({ ...h }));
  const cloud = await readFromCloud(getLayoutKey('sys-tar'), tarDefaults);
  if (cloud && cloud.length) return cloud;
  const local = readLocalCache('sys-tar', tarDefaults);
  if (local && local.length) return local;
  const legacy = readLegacyTarCache(tarDefaults);
  if (legacy && legacy.length) return legacy;
  return tarDefaults;
}

export async function loadHotspotLayout(
  platformId: PlatformIdLike = 'sys-tar',
  subsystems: { id: string; name: string }[] = []
): Promise<LoadResult> {
  const defaults = buildDefaultHotspots(subsystems, platformId);
  const layoutKey = getLayoutKey(platformId);

  // S-TAR: one-time exact copy of TAR titles + positions (independent ids).
  // After that, S-TAR keeps its own saved layout.
  if (platformId === 'sys-star') {
    const COPY_FLAG = 'vector-star-layout-copied-from-tar-v2';
    let alreadyCopied = false;
    try { alreadyCopied = localStorage.getItem(COPY_FLAG) === '1'; } catch { /* ignore */ }

    if (!alreadyCopied) {
      const tar = await loadTarLayoutRaw();
      if (tar) {
        const copied = remapTarLayoutToStar(tar, subsystems);
        if (copied.length) {
          writeLocalCache(platformId, copied);
          await writeToCloud(layoutKey, copied, 'copied-from-tar');
          try { localStorage.setItem(COPY_FLAG, '1'); } catch { /* ignore */ }
          console.log('[hotspotLayout] copied TAR layout to S-TAR', copied.length);
          return { hotspots: copied, source: 'cloud' };
        }
      }
    }

    const existingCloud = await readFromCloud(layoutKey, defaults);
    if (existingCloud && hasPlatformOverlap(existingCloud, subsystems)) {
      writeLocalCache(platformId, existingCloud);
      return { hotspots: existingCloud, source: 'cloud' };
    }
    const existingLocal = readLocalCache(platformId, defaults);
    if (existingLocal && hasPlatformOverlap(existingLocal, subsystems)) {
      return { hotspots: existingLocal, source: 'local' };
    }
  }

  const cloud = await readFromCloud(layoutKey, defaults);
  if (cloud && hasPlatformOverlap(cloud, subsystems)) {
    writeLocalCache(platformId, cloud);
    console.log('[hotspotLayout] using source: cloud', platformId);
    return { hotspots: cloud, source: 'cloud' };
  }

  const local = readLocalCache(platformId, defaults);
  if (local && hasPlatformOverlap(local, subsystems)) {
    console.log('[hotspotLayout] using source: local', platformId);
    return { hotspots: local, source: 'local' };
  }

  console.log('[hotspotLayout] using source: default', platformId);
  return {
    hotspots: defaults,
    source: 'default',
  };
}

/**
 * Publish designed layout for the given platform.
 * Always updates local cache; returns whether cloud write was verified.
 */
export async function saveHotspotLayout(
  platformId: PlatformIdLike,
  hotspots: Hotspot[],
  updatedBy?: string
): Promise<{ cloudSaved: boolean }> {
  writeLocalCache(platformId, hotspots);
  const cloudSaved = await writeToCloud(getLayoutKey(platformId), hotspots, updatedBy);
  return { cloudSaved };
}

/** Reset to platform defaults and clear local cache (does not delete cloud row). */
export function resetHotspotLayoutLocal(
  platformId: PlatformIdLike = 'sys-tar',
  subsystems: { id: string; name: string }[] = []
): Hotspot[] {
  try {
    localStorage.removeItem(localCacheKey(platformId));
  } catch {
    /* ignore */
  }
  return buildDefaultHotspots(subsystems, platformId);
}

// Back-compat export for any leftover references
export const LAYOUT_RECORD_KEY = getLayoutKey('sys-tar');
