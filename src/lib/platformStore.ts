/**
 * Platform selector helper
 * Use this in Architecture, Planning & Cost, Baselines, Change Control
 * so those views operate on one selected System (TAR / S-TAR / M-TAR)
 * while the Registry Tree shows the full family.
 *
 * Drop into src/lib/platformStore.ts
 */
import { TAR_FAMILY, TAR_SYSTEM } from '../data/tarSeedData';
import type { ResourceEntity } from '../types/plm';

const STORAGE_KEY = 'vector-plm-active-platform';

export const PLATFORM_IDS = {
  TAR: 'sys-tar',
  STAR: 'sys-star',
  MTAR: 'sys-mtar',
} as const;

export type PlatformId = (typeof PLATFORM_IDS)[keyof typeof PLATFORM_IDS];

const DEFAULT_PLATFORM: PlatformId = PLATFORM_IDS.TAR;

let activeId: PlatformId = load();

const listeners = new Set<() => void>();

function load(): PlatformId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === PLATFORM_IDS.TAR || raw === PLATFORM_IDS.STAR || raw === PLATFORM_IDS.MTAR) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PLATFORM;
}

function save(id: PlatformId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribePlatform(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getActivePlatformId(): PlatformId {
  return activeId;
}

export function setActivePlatform(id: PlatformId) {
  if (id === activeId) return;
  activeId = id;
  save(id);
  notify();
}

/** Returns the selected System node from the family tree (or TAR as fallback). */
export function getActiveSystem(family: ResourceEntity = TAR_FAMILY): ResourceEntity {
  const systems = (family.children || []).filter((c) => c.type === 'System');
  return systems.find((s) => s.id === activeId) || TAR_SYSTEM;
}

export function getPlatformOptions(): { id: PlatformId; name: string }[] {
  return [
    { id: PLATFORM_IDS.TAR, name: 'TAR™' },
    { id: PLATFORM_IDS.STAR, name: 'S-TAR' },
    { id: PLATFORM_IDS.MTAR, name: 'M-TAR' },
  ];
}
