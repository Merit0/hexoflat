import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { readRespawnSchedule, writeRespawnSchedule } from '@/services/persistence/world-storage';

/**
 * When each location is allowed to regenerate.
 *
 * A location that the hero cleared out is put on a timer; until it expires
 * the world keeps the emptied map, and once it does the stored map is thrown
 * away so the next visit rebuilds it. That is a schedule, not map state —
 * it survives independently of whichever map happens to be loaded, which is
 * why it reads and writes through the persistence layer directly and needs
 * nothing from world-map-store.
 *
 * `Date.now()` stays here rather than in the store: this module is the one
 * place the respawn clock is read, so it is also the seam where a fake clock
 * can be injected later without touching game state.
 */

export function scheduleLocationRespawn(locationKey: LocationKey, delayMs: number): void {
  const schedule = readRespawnSchedule();
  schedule[locationKey] = Date.now() + delayMs;
  writeRespawnSchedule(schedule);
}

export function clearLocationRespawn(locationKey: LocationKey): void {
  const schedule = readRespawnSchedule();
  if (!(locationKey in schedule)) return;
  delete schedule[locationKey];
  writeRespawnSchedule(schedule);
}

export function getLocationRespawnRemainingMs(locationKey: LocationKey): number {
  const respawnAt = readRespawnSchedule()[locationKey];
  if (!respawnAt) return 0;

  return Math.max(0, respawnAt - Date.now());
}

export function isLocationRespawning(locationKey: LocationKey): boolean {
  return getLocationRespawnRemainingMs(locationKey) > 0;
}

/**
 * Reports whether `locationKey`'s timer has come due, and drops it from the
 * schedule if so. Discarding the stored map is deliberately left to the
 * caller — this module owns the clock, not the map.
 */
export function consumeDueLocationRespawn(locationKey: LocationKey): boolean {
  const schedule = readRespawnSchedule();
  const respawnAt = schedule[locationKey];
  if (!respawnAt) return false;
  if (Date.now() < respawnAt) return false;

  delete schedule[locationKey];
  writeRespawnSchedule(schedule);
  return true;
}
