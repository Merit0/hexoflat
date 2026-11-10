import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { holdServedWorld, seedFakeSession } from '@/test-support/fake-session';
import { fakeStoredWorldOf } from '@/test-support/fake-player-server';
import { cachedWorldJson } from '@/services/player/world-sync';
import { useWorldMapStore } from './world-map-store';
import { useBattleStore } from './battle-store';
import { useHeroStore } from './hero-store';

describe('world persistence: the world is the server document', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-persist');
  });

  it('puts the hero where the server document says he stands', () => {
    const served = fakeStoredWorldOf('silesia')!;
    served.heroCoordinates = { columnIndex: 1, rowIndex: 2 };
    holdServedWorld(served);

    useWorldMapStore().loadLocationMap('silesia');

    expect(useHeroStore().heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 2 });
  });

  it('takes the map size from the server document', () => {
    const served = fakeStoredWorldOf('silesia')!;

    useWorldMapStore().loadLocationMap('silesia');

    expect(useWorldMapStore().map?.tiles).toHaveLength(served.map.tiles.length);
  });

  it('cacheServedWorld refreshes the cached document with the changed map', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('silesia');
    const tile = worldStore.map!.tiles.find((candidate) => !candidate.hexobject)!;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.COINS, tile.coordinates);

    worldStore.cacheServedWorld();

    const cached = JSON.parse(cachedWorldJson('silesia')!) as {
      map: { tiles: { hexobject?: { hexobjectKey: string } | null }[] };
    };
    expect(
      cached.map.tiles.filter((entry) => entry.hexobject?.hexobjectKey === HEXOBJECT_KEYS.COINS)
        .length,
    ).toBeGreaterThan(0);
  });

  it('does not cache anything while no map is loaded', () => {
    const worldStore = useWorldMapStore();
    const before = cachedWorldJson('silesia');

    worldStore.cacheServedWorld();

    expect(cachedWorldJson('silesia')).toBe(before);
  });

  it('reports no engagement for a world without a battle', () => {
    useWorldMapStore().loadLocationMap('silesia');

    expect(useBattleStore().inBattle).toBe(false);
  });

  it('restores an engagement the server holds on the map', () => {
    const served = fakeStoredWorldOf('silesia')!;
    const [heroTile, squadTile] = served.map.tiles.filter((candidate) => !candidate.hexobject);
    squadTile.hexobject = HexObjectFactory.create(
      HEXOBJECT_KEYS.SKELETON_PACK,
      squadTile.coordinates,
    );
    served.heroCoordinates = { ...heroTile.coordinates };
    const squadId = `${squadTile.coordinates.columnIndex}:${squadTile.coordinates.rowIndex}:skeleton-pack`;
    served.engagement = {
      squadId,
      ambush: false,
      heroAt: { ...heroTile.coordinates },
      heroIds: ['hero-persist'],
      startItems: {},
    };
    holdServedWorld(served);

    useWorldMapStore().loadLocationMap('silesia');

    expect(useBattleStore().engagement?.squadId).toBe(squadId);
  });
});
