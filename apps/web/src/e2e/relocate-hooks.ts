import { nextTick } from 'vue';
import { LOCATION_KEYS, type LocationKey } from '@hexoflat/engine/registry/location-key';
import { apiClient } from '@/api/client';
import { inventorySession } from '@/services/inventory/inventory-session';
import { applyProgress, settleInventorySync } from '@/services/inventory/inventory-sync';
import { replaceLocationRoute } from '@/services/world/location-navigator';
import { readCachedWorld } from '@/services/world/served-world';
import { useWorldMapStore } from '@/stores/world-map-store';
import type { TestHexCoordinates } from './test-api.types';

type RelocateAnswer = { aggregates: { progress: Parameters<typeof applyProgress>[0] } };

function locationOf(raw: string): LocationKey {
  if (!(LOCATION_KEYS as readonly string[]).includes(raw)) throw new Error('Invalid fixture');
  return raw as LocationKey;
}

export async function relocateHero(raw: string): Promise<void> {
  const locationKey = locationOf(raw);
  await settleInventorySync();
  const answer = await apiClient.post<RelocateAnswer>(
    '/player/dev/relocate-fixture',
    { locationKey },
    { headers: { 'X-Player-Session': inventorySession.sessionToken ?? '' } },
  );
  applyProgress(answer.aggregates.progress);
  await replaceLocationRoute(locationKey);
  await nextTick();
  const worldStore = useWorldMapStore();
  if (worldStore.currentLocationKey !== locationKey) worldStore.goToLocation(locationKey);
}

export function findTilesWithKeyIn(raw: string, key: string): TestHexCoordinates[] {
  const world = readCachedWorld(locationOf(raw));
  if (!world) return [];
  return world.map.tiles
    .filter((tile) => tile.hexobject?.hexobjectKey === key)
    .map(({ coordinates }) => ({
      columnIndex: coordinates.columnIndex,
      rowIndex: coordinates.rowIndex,
    }));
}
