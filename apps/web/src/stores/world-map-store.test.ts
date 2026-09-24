import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { HexEngineActionContext } from '@hexoflat/engine';
import { useWorldMapStore, runWorldTick } from './world-map-store';
import { useHeroStore } from './hero-store';

function buildRevealedMap(width = 3, height = 3) {
  const map = new HexMapBuilder().name('move-test').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

function createEngineContext(
  overrides: Partial<HexEngineActionContext> = {},
): HexEngineActionContext {
  return {
    heroToolStore: {
      isLocked: false,
      isDragging: false,
      activeTool: null,
      hover: null,
      consumeDurability: vi.fn(() => true),
      lockTool: vi.fn(),
      unlockTool: vi.fn(),
      clearResolvedActions: vi.fn(),
      stopTool: vi.fn(),
    },
    hero: {
      hero: { name: 'Hero', maxHealth: 100, currentHealth: 100 },
      healHero: vi.fn(),
    },
    gathering: { add: vi.fn() },
    inventory: { putToInventory: vi.fn(() => ({ ok: true })) },
    events: { push: vi.fn() },
    worldMap: {
      combatActive: false,
      performHeroCombatAttack: vi.fn(() => ({ ok: true, message: '' })),
      placeCombatDefendMarker: vi.fn(() => true),
      isLocationRespawning: vi.fn(() => false),
      getLocationRespawnRemainingMs: vi.fn(() => 0),
      goToLocation: vi.fn(),
    },
    ...overrides,
  };
}

describe('useWorldMapStore: leaveCurrentLocation', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  function buildClearedMap(name: string) {
    const map = buildRevealedMap();
    const tile = map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.GRAVE, tile.coordinates);
    map.name = name;
    return map;
  }

  it('seals a cleared location that declares a respawn delay', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildClearedMap('cave-map');
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';

    worldStore.leaveCurrentLocation('camping');

    expect(worldStore.isLocationRespawning('cave')).toBe(true);
  });

  it('leaves a location alone when its definition declares no respawn delay', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildClearedMap('camping-map');
    worldStore.currentLocationKey = 'camping';
    worldStore.currentMapId = 'camping-map-id';

    worldStore.leaveCurrentLocation('cave');

    expect(worldStore.isLocationRespawning('camping')).toBe(false);
  });

  it('does not seal the location the hero is staying in', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildClearedMap('cave-map');
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';

    worldStore.leaveCurrentLocation('cave');

    expect(worldStore.isLocationRespawning('cave')).toBe(false);
  });

  it('does not seal a location that has not been cleared', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildRevealedMap();
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';

    worldStore.leaveCurrentLocation('camping');

    expect(worldStore.isLocationRespawning('cave')).toBe(false);
  });

  it('discards a DUNGEON board on the way to a different location, instead of saving it', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildRevealedMap();
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';
    const clearSpy = vi.spyOn(worldStore, 'clearStoredLocation');
    const saveSpy = vi.spyOn(worldStore, 'saveToStorage');

    worldStore.leaveCurrentLocation('silesia');

    expect(clearSpy).toHaveBeenCalledWith('cave', 'cave-map-id');
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('saves a DUNGEON board instead of discarding it when staying on the same location', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildRevealedMap();
    worldStore.currentLocationKey = 'cave';
    worldStore.currentMapId = 'cave-map-id';
    const clearSpy = vi.spyOn(worldStore, 'clearStoredLocation');
    const saveSpy = vi.spyOn(worldStore, 'saveToStorage');

    worldStore.leaveCurrentLocation('cave');

    expect(clearSpy).not.toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledWith('cave-map-id');
  });

  it('saves a STATIC board rather than discarding it on the way to a different location', () => {
    const worldStore = useWorldMapStore();
    worldStore.map = buildRevealedMap();
    worldStore.currentLocationKey = 'silesia';
    worldStore.currentMapId = 'silesia-map-id';
    const clearSpy = vi.spyOn(worldStore, 'clearStoredLocation');
    const saveSpy = vi.spyOn(worldStore, 'saveToStorage');

    worldStore.leaveCurrentLocation('cave');

    expect(clearSpy).not.toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalledWith('silesia-map-id');
  });
});

describe('useWorldMapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('runWorldTick', () => {
    it('finishes a due pending action and reports changed:true', () => {
      const map = buildRevealedMap(2, 1);
      const tile = map.tiles[0];
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.TREE, tile.coordinates);
      tile.pendingAction = {
        type: 'CUT' as never,
        startedAt: 0,
        endsAt: 1000,
        hexobjectKey: HEXOBJECT_KEYS.TREE,
        cancelled: false,
      };
      const ctx = createEngineContext();

      const changed = runWorldTick(map, 1000, ctx);

      expect(changed).toBe(true);
      expect(tile.pendingAction).toBeNull();
      expect(tile.hexobject).toBeNull();
    });

    it('reports changed:false when nothing is due', () => {
      const map = buildRevealedMap(2, 1);
      const ctx = createEngineContext();

      const changed = runWorldTick(map, 0, ctx);

      expect(changed).toBe(false);
    });
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

describe('useWorldMapStore: board creation (C1/C2 wiring)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('builds silesia as a STATIC board via MapRegistry', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('silesia');

    expect(worldStore.descriptor).toMatchObject({ kind: 'STATIC', id: 'silesia' });
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
  });

  it('builds cave as a DUNGEON board via MapRegistry', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('cave');

    expect(worldStore.descriptor?.kind).toBe('DUNGEON');
    expect(worldStore.map?.tiles.length).toBeGreaterThan(0);
  });

  it('rebuilds a saved STATIC board once its drawing hash no longer matches', () => {
    const staleMapId = 'stale-silesia-id';
    const staleTile = {
      coordinates: { columnIndex: 0, rowIndex: 0 },
      isRevealed: true,
      hexobject: null,
      resourceSpawner: null,
      pendingAction: null,
    };
    localStorage.setItem('hexoflat:world:index:v1', JSON.stringify({ silesia: staleMapId }));
    localStorage.setItem(
      'hexoflat:world:map:v1:' + staleMapId,
      JSON.stringify({
        contentVersion: 1,
        map: { name: 'stale', width: 1, height: 1, complexity: 0, config: [], tiles: [staleTile] },
      }),
    );
    localStorage.setItem(
      'hexoflat:world:state:v1:' + staleMapId,
      JSON.stringify({
        contentVersion: 1,
        heroCoordinates: null,
        descriptor: { kind: 'STATIC', id: 'silesia', drawingHash: 'stale-hash' },
      }),
    );

    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('silesia', staleMapId);

    expect(worldStore.descriptor).toMatchObject({ kind: 'STATIC', id: 'silesia' });
    expect((worldStore.descriptor as { drawingHash?: string })?.drawingHash).not.toBe('stale-hash');
    expect(worldStore.map?.tiles.length).toBeGreaterThan(1);
  });

  it('a reload inside the cave (bootstrapWorld with the saved mapId) gives the same board back', () => {
    const worldStore = useWorldMapStore();

    worldStore.loadLocationMap('cave');
    const mapId = worldStore.currentMapId as string;
    const descriptorAfterFirstLoad = worldStore.descriptor;

    worldStore.map = null;
    worldStore.descriptor = null;
    worldStore.loadLocationMap('cave', mapId);

    expect(worldStore.descriptor).toEqual(descriptorAfterFirstLoad);
  });
});

describe('useWorldMapStore: dev board panel actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('devRegenerateDungeon discards the old mapId and builds a different board under a new one', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');
    const oldMapId = worldStore.currentMapId;
    const oldDescriptor = worldStore.descriptor;

    worldStore.devRegenerateDungeon();

    expect(worldStore.currentMapId).not.toBe(oldMapId);
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

  it('devForceLayout rebuilds using exactly the requested layout', () => {
    const worldStore = useWorldMapStore();
    worldStore.loadLocationMap('cave');
    const layoutId = 'basin-01';

    worldStore.devForceLayout(layoutId);

    expect(worldStore.descriptor?.kind === 'DUNGEON' && worldStore.descriptor.layoutId).toBe(
      layoutId,
    );
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
