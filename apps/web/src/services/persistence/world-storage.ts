import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import type { ISerializedHexMap } from '@hexoflat/engine/map/models/hex-map-model';
import { CONTENT_VERSION } from '@hexoflat/engine';
import {
  cachedWorldJsonByMap,
  isServerWorldMode,
  queueWorldPush,
} from '@/services/player/world-sync';
import { readBlob, removeBlob, writeBlob } from './world-blob-store';

/**
 * The single owner of world persistence: every document key the world uses and the
 * CONTENT_VERSION gate. The documents live in `world-blob-store` (a copy of the server's
 * expedition, D4a); `expedition-sync` sends changes on with its own debounce.
 *
 * This module deliberately imports no store. Callers pass data in and get
 * data out — that is what keeps it unit-testable on its own, and what stops
 * it from becoming another edge in the world-map-store <-> hero-store
 * cycle (see G2 in docs/refactoring/GOD-CLASS-REFACTORING-PLAN.md). It owns
 * the on-disk *format*; deciding *what* is worth saving stays with the
 * stores that own that state.
 */

const MAP_KEY = (mapId: string) => `map:${mapId}`;
const STATE_KEY = (mapId: string) => `state:${mapId}`;
const INDEX_KEY = 'index';
const RESPAWN_KEY = 'respawn';

export function newMapId(): string {
  return crypto.randomUUID();
}

function readJson<T>(key: string, empty: T): T {
  const raw = readBlob(key);
  return raw ? (JSON.parse(raw) as T) : empty;
}

export function readLocationMapIndex(): Partial<Record<LocationKey, string>> {
  return readJson(INDEX_KEY, {});
}

export function writeLocationMapIndex(index: Partial<Record<LocationKey, string>>): void {
  writeBlob(INDEX_KEY, JSON.stringify(index));
}

export function clearLocationMapIndex(): void {
  removeBlob(INDEX_KEY);
}

export function readRespawnSchedule(): Partial<Record<LocationKey, number>> {
  return readJson(RESPAWN_KEY, {});
}

export function writeRespawnSchedule(schedule: Partial<Record<LocationKey, number>>): void {
  writeBlob(RESPAWN_KEY, JSON.stringify(schedule));
}

/**
 * Both snapshots must already be serialized by the caller, at the moment the save was requested.
 * The copy is updated at once; sending it to the server is debounced elsewhere.
 */
export function scheduleWorldSave(
  mapId: string,
  mapSnapshot: string | null,
  stateSnapshot: string,
): void {
  if (mapSnapshot) writeBlob(MAP_KEY(mapId), mapSnapshot);
  writeBlob(STATE_KEY(mapId), stateSnapshot);
}

export function readSavedMap(mapId: string): ISerializedHexMap | null {
  if (isServerWorldMode()) {
    const held = cachedWorldJsonByMap(mapId);
    return held ? (JSON.parse(held.json) as { map: ISerializedHexMap }).map : null;
  }
  const saved = readBlob(MAP_KEY(mapId));
  const parsed = saved
    ? (JSON.parse(saved) as { contentVersion?: number; map?: ISerializedHexMap })
    : null;

  if (parsed?.map && parsed.contentVersion === CONTENT_VERSION) return parsed.map;

  if (parsed) {
    console.warn(
      `[world-map-store] Discarding saved map for "${mapId}": content version mismatch.`,
    );
    removeBlob(MAP_KEY(mapId));
  }
  return null;
}

export function readSavedWorldState<T extends { contentVersion?: number }>(
  mapId: string,
): Partial<T> | null {
  const saved = readBlob(STATE_KEY(mapId));
  const raw = saved ? (JSON.parse(saved) as Partial<T>) : null;

  if (raw && raw.contentVersion === CONTENT_VERSION) return raw;

  if (raw) {
    console.warn(
      `[world-map-store] Discarding saved world state for "${mapId}": content version mismatch.`,
    );
    removeBlob(STATE_KEY(mapId));
  }
  return null;
}

export function removeSavedWorld(mapId: string): void {
  removeBlob(MAP_KEY(mapId));
  removeBlob(STATE_KEY(mapId));
}

export function updateSavedMap(
  mapId: string,
  mutate: (map: ISerializedHexMap) => boolean,
): boolean {
  if (isServerWorldMode()) {
    const held = cachedWorldJsonByMap(mapId);
    if (!held) return false;
    const doc = JSON.parse(held.json) as { map: ISerializedHexMap };
    if (!mutate(doc.map)) return false;
    queueWorldPush(held.locationKey, mapId, JSON.stringify(doc));
    return true;
  }
  const map = readSavedMap(mapId);
  if (!map || !mutate(map)) return false;

  const stateSnapshot =
    readBlob(STATE_KEY(mapId)) ?? JSON.stringify({ contentVersion: CONTENT_VERSION });
  scheduleWorldSave(mapId, JSON.stringify({ contentVersion: CONTENT_VERSION, map }), stateSnapshot);
  return true;
}
