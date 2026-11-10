import { seedFakeSession } from '@/test-support/fake-session';
import { inventorySession } from '@/services/inventory/inventory-session';
import { forgetAllServerWorlds, forgetServerWorld } from '@/services/player/world-sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { BOARD_MODELS } from '@hexoflat/engine/content/boards/models/index';
import { adjustRuleCount } from '@hexoflat/engine/boards/board-model-edit';
import { useWorldMapStore } from './world-map-store';
import { useHeroStore } from './hero-store';

function buildRevealedMap(width = 3, height = 3) {
  const map = new HexMapBuilder().name('move-test').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

describe('useWorldMapStore: leaveCurrentLocation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-wm');
  });

  it('remembers where the hero stood and stops the world loop', () => {
    const worldStore = useWorldMapStore();
    const hero = useHeroStore();
    worldStore.map = buildRevealedMap();
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';
    hero.heroCoordinates = { columnIndex: 1, rowIndex: 1 };
    const stopSpy = vi.spyOn(worldStore, 'stopWorldLoop');

    worldStore.leaveCurrentLocation();

    expect(hero.nav.positionByMapId['cave-map-id']).toEqual({ columnIndex: 1, rowIndex: 1 });
    expect(stopSpy).toHaveBeenCalled();
  });

  it('reads the seal of a location from the server progress', () => {
    const worldStore = useWorldMapStore();
    inventorySession.sealedUntil = { cave: Date.now() + 60_000 };

    expect(worldStore.isLocationRespawning('cave')).toBe(true);
    expect(worldStore.isLocationRespawning('camping')).toBe(false);
    expect(worldStore.getLocationRespawnRemainingMs('cave')).toBeGreaterThan(0);
  });
});

describe('useWorldMapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-wm');
  });

  describe('dirty-tile tracking', () => {
    beforeEach(() => {
      useWorldMapStore().consumeDirtyTileIds();
    });

    it('marking one tile dirty does not mark the rest of the map', () => {
      const worldStore = useWorldMapStore();
      const map = new HexMapBuilder().name('dirty-test').width(5).height(5).build();
      for (const tile of map.tiles) tile.isRevealed = false;
      worldStore.map = map;

      const target = map.tiles[7].coordinates;
      worldStore.markTileDirty(target);

      const dirty = worldStore.consumeDirtyTileIds();

      expect(dirty.size).toBe(1);
      expect(dirty.has(`${target.columnIndex}:${target.rowIndex}`)).toBe(true);
      expect(dirty.size).toBeLessThan(map.tiles.length);
    });

    it('consumeDirtyTileIds clears the pending set, so a second read is empty', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = new HexMapBuilder().name('dirty-test-2').width(2).height(1).build();

      worldStore.markTileDirty(worldStore.map.tiles[0].coordinates);
      worldStore.consumeDirtyTileIds();

      expect(worldStore.consumeDirtyTileIds().size).toBe(0);
    });

    it('markTilesDirty is a no-op (no dirtyTick bump) for an empty list', () => {
      const worldStore = useWorldMapStore();
      worldStore.map = new HexMapBuilder().name('dirty-test-3').width(2).height(1).build();

      const before = worldStore.dirtyTick;
      worldStore.markTilesDirty([]);

      expect(worldStore.dirtyTick).toBe(before);
      expect(worldStore.consumeDirtyTileIds().size).toBe(0);
    });

    it('markAllTilesDirty marks every tile on the current map', () => {
      const worldStore = useWorldMapStore();
      const map = new HexMapBuilder().name('dirty-test-4').width(3).height(3).build();
      worldStore.map = map;

      worldStore.markAllTilesDirty();
      const dirty = worldStore.consumeDirtyTileIds();

      expect(dirty.size).toBe(map.tiles.length);
    });

    it('revealAroundHero only marks the hero tile and its neighbors dirty, not the whole map', () => {
      const worldStore = useWorldMapStore();
      const map = new HexMapBuilder().name('dirty-test-5').width(6).height(6).build();
      for (const tile of map.tiles) tile.isRevealed = false;
      worldStore.map = map;
      useHeroStore().heroCoordinates = { columnIndex: 2, rowIndex: 2 };

      worldStore.revealAroundHero();
      const dirty = worldStore.consumeDirtyTileIds();

      expect(dirty.size).toBeGreaterThan(0);
      expect(dirty.size).toBeLessThan(map.tiles.length);
    });

    it('initFog marks every tile on the map dirty', () => {
      const worldStore = useWorldMapStore();
      const map = new HexMapBuilder().name('dirty-test-6').width(4).height(4).build();
      worldStore.map = map;
      worldStore.consumeDirtyTileIds(); // discard whatever the builder/initial state left pending

      worldStore.initFog();
      const dirty = worldStore.consumeDirtyTileIds();

      expect(dirty.size).toBe(map.tiles.length);
    });
  });
});

describe('useWorldMapStore: maps come from the server', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-wm');
  });

  it('shows silesia as the STATIC board the server built', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('silesia');

    expect(worldStore.descriptor).toMatchObject({ kind: 'STATIC', id: 'silesia' });
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
    expect(worldStore.worldLoadFailed).toBe(false);
  });

  it('shows cave as the RECIPE board the server built', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('cave');

    expect(worldStore.descriptor).toMatchObject({ kind: 'RECIPE', recipeId: 'cave' });
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
  });

  it('gives the same board back when the cave is loaded again', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('cave');
    const mapId = worldStore.currentMapId;
    const descriptor = worldStore.descriptor;
    worldStore.map = null;
    worldStore.descriptor = null;
    worldStore.loadLocationMap('cave');

    expect(worldStore.currentMapId).toBe(mapId);
    expect(worldStore.descriptor).toEqual(descriptor);
  });

  it('never generates a map locally: no server document means a load failure and no map', () => {
    const worldStore = useWorldMapStore();
    forgetServerWorld('cave');

    worldStore.loadLocationMap('cave');

    expect(worldStore.worldLoadFailed).toBe(true);
    expect(worldStore.map).toBeNull();
    expect(worldStore.currentMapId).toBeNull();
  });

  it('retryWorldLoad fetches the documents again and loads the map', async () => {
    const worldStore = useWorldMapStore();
    forgetAllServerWorlds();
    worldStore.loadLocationMap('camping');
    expect(worldStore.worldLoadFailed).toBe(true);

    await worldStore.retryWorldLoad();

    expect(worldStore.worldLoadFailed).toBe(false);
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
  });
});

describe('useWorldMapStore: dev board panel actions (in-memory preview)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    seedFakeSession('hero-wm');
  });

  it('devRegenerateDungeon builds a different board under the same server mapId', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');
    const mapId = worldStore.currentMapId;
    const oldDescriptor = worldStore.descriptor;

    worldStore.devRegenerateDungeon();

    expect(worldStore.currentMapId).toBe(mapId);
    expect(worldStore.descriptor).not.toEqual(oldDescriptor);
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
  });

  it('devNextSeed rebuilds under the same mapId with a different board', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');
    const mapId = worldStore.currentMapId;
    const oldDescriptor = worldStore.descriptor;

    worldStore.devNextSeed();

    expect(worldStore.currentMapId).toBe(mapId);
    expect(worldStore.descriptor).not.toEqual(oldDescriptor);
  });

  it('devRebuildFromRecipe rebuilds the same seed with an edited model', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');
    const countRocks = () =>
      worldStore.map?.tiles.filter((tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.ROCK)
        .length ?? 0;
    const before = countRocks();
    const seedBefore = worldStore.descriptor?.kind === 'RECIPE' && worldStore.descriptor.seed;

    worldStore.devRebuildFromRecipe(adjustRuleCount(BOARD_MODELS.cave, 'rocks', 4));

    expect(countRocks()).toBeGreaterThan(before);
    expect(worldStore.descriptor?.kind === 'RECIPE' && worldStore.descriptor.seed).toBe(seedBefore);
  });

  it('devRebuildFromRecipe is a no-op on a STATIC location', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('silesia');
    const descriptor = worldStore.descriptor;

    worldStore.devRebuildFromRecipe(BOARD_MODELS.cave);

    expect(worldStore.descriptor).toEqual(descriptor);
  });

  it('dev rebuild actions use the recipe params they are given', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');

    worldStore.devNextSeed({ tier: 3 });
    expect(worldStore.descriptor?.kind === 'RECIPE' && worldStore.descriptor.params).toEqual({
      tier: 3,
    });

    worldStore.devRebuildFromRecipe(BOARD_MODELS.cave, { tier: 2, partySize: 2 });
    expect(worldStore.descriptor?.kind === 'RECIPE' && worldStore.descriptor.params).toEqual({
      tier: 2,
      partySize: 2,
    });
  });

  it('dev actions are no-ops on a STATIC location', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('silesia');
    const mapId = worldStore.currentMapId;
    const descriptor = worldStore.descriptor;

    worldStore.devRegenerateDungeon();
    worldStore.devNextSeed();

    expect(worldStore.currentMapId).toBe(mapId);
    expect(worldStore.descriptor).toEqual(descriptor);
  });
});

describe('respawnHeroAtCampingAction: the server already moved the hero', () => {
  it('closes the battle and walks to the camp the server built (REQ-B4-RSP-001)', async () => {
    const { respawnHeroAtCampingAction } = await import('./camp-respawn-action');
    const calls: string[] = [];
    const result = { ok: true, travel: { locationKey: 'camping' } } as never;
    await respawnHeroAtCampingAction(
      { goToLocation: (...args) => calls.push(`go:${args.join(',')}`) },
      result,
      {
        events: { push: () => calls.push('log') },
        battle: { close: () => calls.push('close') },
        installTravel: () => {
          calls.push('install');
          return 'camping';
        },
        isViewingOtherWorldLocation: () => true,
        routeToLocation: () => {
          calls.push('route');
          return Promise.resolve();
        },
      },
    );
    expect(calls).toEqual(['close', 'install', 'go:camping', 'log', 'route']);
  });
});
