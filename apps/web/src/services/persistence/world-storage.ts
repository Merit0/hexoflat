import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { ISerializedHexMap } from '@hexoflat/engine/map/models/hex-map-model';
import { CONTENT_VERSION } from '@hexoflat/engine';

/**
 * The single owner of world persistence: every localStorage key the world
 * uses, the CONTENT_VERSION gate, the debounce, and the tab-close flush.
 *
 * This module deliberately imports no store. Callers pass data in and get
 * data out — that is what keeps it unit-testable on its own, and what stops
 * it from becoming another edge in the world-map-store <-> combat-store
 * cycle (see G2 in docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md). It owns
 * the on-disk *format*; deciding *what* is worth saving stays with the
 * stores that own that state.
 */

const STORAGE_MAP_PREFIX = 'hexoflat:world:map:v1:';
const STORAGE_STATE_PREFIX = 'hexoflat:world:state:v1:';
const STORAGE_INDEX = 'hexoflat:world:index:v1';
const STORAGE_RESPAWN_AT = 'hexoflat:world:respawn-at:v1';
const SAVE_DEBOUNCE_MS = 750;

export function newMapId(): string {
  return crypto.randomUUID();
}

export function readLocationMapIndex(): Partial<Record<LocationKey, string>> {
  const raw = localStorage.getItem(STORAGE_INDEX);
  return raw ? (JSON.parse(raw) as Partial<Record<LocationKey, string>>) : {};
}

export function writeLocationMapIndex(index: Partial<Record<LocationKey, string>>): void {
  localStorage.setItem(STORAGE_INDEX, JSON.stringify(index));
}

export function clearLocationMapIndex(): void {
  localStorage.removeItem(STORAGE_INDEX);
}

export function readRespawnSchedule(): Partial<Record<LocationKey, number>> {
  const raw = localStorage.getItem(STORAGE_RESPAWN_AT);
  return raw ? (JSON.parse(raw) as Partial<Record<LocationKey, number>>) : {};
}

export function writeRespawnSchedule(schedule: Partial<Record<LocationKey, number>>): void {
  localStorage.setItem(STORAGE_RESPAWN_AT, JSON.stringify(schedule));
}

interface PendingSave {
  mapSnapshot: string | null;
  stateSnapshot: string;
  timer: number;
}

const pendingSaves = new Map<string, PendingSave>();

function flushPendingSave(mapId: string, save: PendingSave) {
  if (save.mapSnapshot) localStorage.setItem(STORAGE_MAP_PREFIX + mapId, save.mapSnapshot);
  localStorage.setItem(STORAGE_STATE_PREFIX + mapId, save.stateSnapshot);
}

// Debounced writes are still pending in memory until their timer fires — flush
// them immediately so a tab close doesn't silently lose the last ~750ms of state.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    for (const [mapId, save] of pendingSaves) {
      window.clearTimeout(save.timer);
      flushPendingSave(mapId, save);
    }
    pendingSaves.clear();
  });
}

/**
 * Queues a debounced write. Both snapshots must already be serialized by the
 * caller, at the moment the save was requested — the debounce delays the
 * write, never the read of the state being written.
 */
export function scheduleWorldSave(
  mapId: string,
  mapSnapshot: string | null,
  stateSnapshot: string,
): void {
  const existing = pendingSaves.get(mapId);
  if (existing) window.clearTimeout(existing.timer);

  const timer = window.setTimeout(() => {
    const save = pendingSaves.get(mapId);
    pendingSaves.delete(mapId);
    if (save) flushPendingSave(mapId, save);
  }, SAVE_DEBOUNCE_MS);

  pendingSaves.set(mapId, { mapSnapshot, stateSnapshot, timer });
}

export function readSavedMap(mapId: string): ISerializedHexMap | null {
  const saved =
    pendingSaves.get(mapId)?.mapSnapshot ?? localStorage.getItem(STORAGE_MAP_PREFIX + mapId);
  const parsed = saved
    ? (JSON.parse(saved) as { contentVersion?: number; map?: ISerializedHexMap })
    : null;

  if (parsed?.map && parsed.contentVersion === CONTENT_VERSION) return parsed.map;

  if (parsed) {
    console.warn(
      `[world-map-store] Discarding saved map for "${mapId}": content version mismatch.`,
    );
    localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
  }
  return null;
}

export function readSavedWorldState<T extends { contentVersion?: number }>(
  mapId: string,
): Partial<T> | null {
  const saved =
    pendingSaves.get(mapId)?.stateSnapshot ?? localStorage.getItem(STORAGE_STATE_PREFIX + mapId);
  const raw = saved ? (JSON.parse(saved) as Partial<T>) : null;

  if (raw && raw.contentVersion === CONTENT_VERSION) return raw;

  if (raw) {
    console.warn(
      `[world-map-store] Discarding saved world state for "${mapId}": content version mismatch.`,
    );
    localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
  }
  return null;
}

export function removeSavedWorld(mapId: string): void {
  const pending = pendingSaves.get(mapId);
  if (pending) {
    window.clearTimeout(pending.timer);
    pendingSaves.delete(mapId);
  }
  localStorage.removeItem(STORAGE_MAP_PREFIX + mapId);
  localStorage.removeItem(STORAGE_STATE_PREFIX + mapId);
}
