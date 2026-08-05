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

describe('useWorldMapStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  describe('moveHeroTo', () => {
    it('moves the hero to an adjacent revealed tile and records the step', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      const map = buildRevealedMap();
      worldStore.map = map;
      worldStore.currentMapId = 'move-test-map';
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      const moved = await worldStore.moveHeroTo({ columnIndex: 1, rowIndex: 0 });

      expect(moved).toBe(true);
      expect(worldStore.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 0 });
      expect(heroStore.hero.heroSteps).toBe(1);
    });

    it('rejects moving onto an unrevealed tile', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      const map = new HexMapBuilder().name('fog-test').width(3).height(3).build();
      for (const tile of map.tiles) tile.isRevealed = false;
      map.tiles[0].isRevealed = true;
      worldStore.map = map;
      worldStore.currentMapId = 'fog-test-map';
      worldStore.heroCoordinates = { ...map.tiles[0].coordinates };

      const target = map.tiles.find((t) => !t.isRevealed)!.coordinates;
      const moved = await worldStore.moveHeroTo(target);

      expect(moved).toBe(false);
      expect(worldStore.heroCoordinates).toEqual(map.tiles[0].coordinates);
    });

    it('rejects moving onto a tile with a solid object', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      const map = buildRevealedMap();
      worldStore.map = map;
      worldStore.currentMapId = 'blocked-test-map';
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      const blockedCoord = { columnIndex: 1, rowIndex: 0 };
      const blockedTile = map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === blockedCoord.columnIndex &&
          t.coordinates.rowIndex === blockedCoord.rowIndex,
      )!;
      blockedTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HOMELAND_GATE, blockedCoord);

      const moved = await worldStore.moveHeroTo(blockedCoord);

      expect(moved).toBe(false);
      expect(worldStore.heroCoordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
    });

    it('rejects moving while a move is already in flight', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      worldStore.map = buildRevealedMap();
      worldStore.currentMapId = 'busy-test-map';
      worldStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      worldStore.isHeroMoving = true;

      const moved = await worldStore.moveHeroTo({ columnIndex: 1, rowIndex: 0 });

      expect(moved).toBe(false);
    });
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
      // dirtyTileIds is module-level state (deliberately, like worldTimer/
      // pendingSaves elsewhere in this file — it should outlive Pinia store
      // resets in the real app), so it isn't cleared by setActivePinia(...)
      // above. Drain any carryover from earlier tests before each one here.
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
      worldStore.heroCoordinates = { columnIndex: 2, rowIndex: 2 };

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
