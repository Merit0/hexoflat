import type { KnowledgeState } from '@hexoflat/engine/knowledge/state';
import { setAuthToken } from '@/api/auth-token';
import { inventorySession, resetInventorySession } from '@/services/inventory/inventory-session';
import { applyProgress } from '@/services/inventory/inventory-sync';
import { vi } from 'vitest';
import { apiClient } from '@/api/client';
import HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { serializeWorld, type ServerWorld } from '@hexoflat/engine/world/server-world';
import { LOCATION_KEYS } from '@hexoflat/engine/registry/location-key';
import { cacheServerWorld, resetWorldSync } from '@/services/player/world-sync';
import {
  fakeEnsureWorld,
  fakeStoreWorld,
  fakeWorldSnapshot,
  resetFakePlayerServer,
  snapshot,
} from './fake-player-server';

export function seedFakeSession(
  heroId: string,
  start: { will?: number; skills?: KnowledgeState['skills'] } = {},
): void {
  resetFakePlayerServer(heroId, (progress) => {
    if (start.will !== undefined) progress.knowledge.current = start.will;
    if (start.skills) progress.knowledge.skills = start.skills;
  });
  setAuthToken('token');
  resetWorldSync();
  vi.spyOn(apiClient, 'get').mockImplementation(() =>
    Promise.resolve(fakeWorldSnapshot() as never),
  );
  vi.spyOn(apiClient, 'post').mockImplementation((path: string, body?: unknown) =>
    Promise.resolve(
      (path === '/player/world/ensure'
        ? fakeEnsureWorld((body as { locationKey: string }).locationKey)
        : {}) as never,
    ),
  );
  for (const locationKey of LOCATION_KEYS) {
    const world = fakeEnsureWorld(locationKey);
    cacheServerWorld(locationKey, JSON.stringify(world));
  }
  resetInventorySession();
  inventorySession.heroId = heroId;
  inventorySession.status = 'live';
  const { aggregates } = snapshot();
  applyProgress(aggregates.progress);
  inventorySession.claimedRewards = ['camp-first-chest'];
}

export function holdServedWorld(served: ServerWorld): void {
  fakeStoreWorld(served);
  cacheServerWorld(served.locationKey, JSON.stringify(serializeWorld(served)));
}

export function holdLocalWorld(held: {
  locationKey: ServerWorld['locationKey'];
  mapId: string;
  map: HexMapModel;
  heroCoordinates: ServerWorld['heroCoordinates'];
}): void {
  fakeStoreWorld({
    locationKey: held.locationKey,
    mapId: held.mapId,
    map: HexMapModel.fromJSON(held.map.toJSON(), Date.now(), { keepUseActions: true }),
    descriptor: null,
    heroCoordinates: held.heroCoordinates ? { ...held.heroCoordinates } : null,
    worldSeed: 'local-test',
    engagement: null,
    battle: null,
  });
}
