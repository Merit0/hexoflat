import type { LocationKey } from '@hexoflat/engine/registry/world-map-registry';
import { inventorySession } from '@/services/inventory/inventory-session';

export function getLocationRespawnRemainingMs(locationKey: LocationKey): number {
  return Math.max(0, (inventorySession.sealedUntil[locationKey] ?? 0) - Date.now());
}

export function isLocationRespawning(locationKey: LocationKey): boolean {
  return getLocationRespawnRemainingMs(locationKey) > 0;
}
