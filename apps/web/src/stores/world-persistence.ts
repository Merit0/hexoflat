import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';

const STORAGE_INDEX = 'hexoflat:world:index:v1';
const STORAGE_RESPAWN_AT = 'hexoflat:world:respawn-at:v1';

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
