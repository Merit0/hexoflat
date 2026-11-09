import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import {
  fakePresence,
  fakeStoredWorld,
  fakeStoredWorldOf,
} from '@/test-support/fake-player-server';
import { seedFakeSession } from '@/test-support/fake-session';
import { flushWorld } from '@/services/inventory/inventory-sync';
import { queueWorldPush, takePendingPushes } from '@/services/player/world-sync';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';
import { useWorldMapStore } from '@/stores/world-map-store';
import { usePortal } from './use-portal';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);
vi.mock('@/services/world/location-navigator', () => ({
  navigateToLocation: vi.fn(),
  isViewingOtherWorldLocation: vi.fn(() => false),
  routeToLocation: vi.fn(async () => {}),
}));

const PORTAL = HEXOBJECT_KEYS.RETURN_PORTAL;

function portalKeys(map: HexMapModel) {
  return map.tiles
    .filter((tile) => tile.hexobject?.hexobjectKey === PORTAL)
    .map((tile) => coordinateKey(tile.coordinates));
}

function start(location: 'silesia' | 'cave') {
  const hero = useHeroStore();
  const world = useWorldMapStore();
  const inventory = useHeroInventoryStore();
  hero.hero.id = 'hero-1';
  seedFakeSession('hero-1', { will: 20, skills: { a_crest: 1, a_teleport: 6 } });
  hero.loadKnowledge();
  inventory.hydrate();
  inventory.putToInventory(HEXOBJECT_KEYS.RETURN_SCROLL, 2);
  world.goToLocation(location);
  const map = world.map as HexMapModel;
  const target = getHexNeighbors(hero.heroCoordinates!).find((c) => {
    const tile = map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(c));
    return tile?.terrain === 'ground' && !tile.hexobject && !tile.exit;
  })!;
  return { hero, world, target };
}

describe('the temporary world paths reach the server through PUT /player/world', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.stubGlobal('navigator', { locks: { request: (_key: string, run: () => unknown) => run() } });
  });

  it('keeps the portal hexes and the hero place on the server through a portal trip', async () => {
    const { hero, world, target } = start('silesia');
    const portal = usePortal();
    await portal.openPortal(target);
    await portal.enterPortal();
    await flushWorld();

    expect(world.currentLocationKey).toBe('camping');
    expect(fakePresence()).toMatchObject({ locationKey: 'camping', mapId: world.currentMapId });
    expect(portalKeys(fakeStoredWorldOf('camping')!.map)).toEqual(
      portalKeys(world.map as HexMapModel),
    );
    expect(portalKeys(fakeStoredWorldOf('silesia')!.map)).toEqual([coordinateKey(target)]);

    await portal.enterPortal();
    await flushWorld();

    expect(world.currentLocationKey).toBe('silesia');
    expect(fakePresence()).toMatchObject({ locationKey: 'silesia', mapId: world.currentMapId });
    expect(portalKeys(fakeStoredWorldOf('silesia')!.map)).toEqual([]);
    expect(hero.portal).toBeNull();
  });

  it('replaces a left dungeon on the server with a fresh map, so a reload cannot bring it back', async () => {
    const { world } = start('cave');
    const oldMapId = world.currentMapId!;
    await flushWorld();
    expect(fakeStoredWorld(oldMapId)).not.toBeNull();

    world.goToLocation('camping');
    await flushWorld();

    expect(fakeStoredWorld(oldMapId)).toBeNull();
    const fresh = fakeStoredWorldOf('cave')!;
    expect(fresh.mapId).not.toBe(oldMapId);
    expect(fakePresence()).toMatchObject({ locationKey: 'camping' });
  });

  it('gives the defeated location a fresh server map and puts the hero at the camp', async () => {
    const { hero, world } = start('silesia');
    const oldMapId = world.currentMapId!;
    await flushWorld();

    await world.respawnHeroAtCamping();
    await flushWorld();

    expect(world.currentLocationKey).toBe('camping');
    expect(fakeStoredWorldOf('silesia')!.mapId).not.toBe(oldMapId);
    expect(fakePresence()).toMatchObject({ locationKey: 'camping', mapId: world.currentMapId });
    expect(hero.heroCoordinates).not.toBeNull();
  });

  it('pushes the maps in the order they were last changed, so the last one is where the hero is', () => {
    queueWorldPush('silesia', 'a', '{"n":1}');
    queueWorldPush('camping', 'b', '{"n":2}');
    queueWorldPush('silesia', 'a', '{"n":3}');
    expect(takePendingPushes().map((push) => push.mapId)).toEqual(['b', 'a']);
  });
});
