import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { HexMapBuilder } from '@hexoflat/engine/map/builders/hex-map-builder';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStore } from './hero-store';
import { useWorldMapStore } from './world-map-store';

function buildRevealedMap(width = 3, height = 3) {
  const map = new HexMapBuilder().name('move-test').width(width).height(height).build();
  for (const tile of map.tiles) tile.isRevealed = true;
  return map;
}

describe('useHeroStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  // moveHeroTo lives here rather than on world-map-store: moving is hero
  // behaviour that needs map data to validate, not map behaviour. It still
  // reaches into world-map-store for the currently loaded map and its
  // reveal/save actions — see the note on this action in hero-store.ts.
  describe('moveHeroTo', () => {
    it('moves the hero to an adjacent revealed tile and records the step', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      const map = buildRevealedMap();
      worldStore.map = map;
      worldStore.currentMapId = 'move-test-map';
      heroStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      const moved = await heroStore.moveHeroTo({ columnIndex: 1, rowIndex: 0 });

      expect(moved).toBe(true);
      expect(heroStore.heroCoordinates).toEqual({ columnIndex: 1, rowIndex: 0 });
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
      heroStore.heroCoordinates = { ...map.tiles[0].coordinates };

      const target = map.tiles.find((t) => !t.isRevealed)!.coordinates;
      const moved = await heroStore.moveHeroTo(target);

      expect(moved).toBe(false);
      expect(heroStore.heroCoordinates).toEqual(map.tiles[0].coordinates);
    });

    it('rejects moving onto a tile with a solid object', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      const map = buildRevealedMap();
      worldStore.map = map;
      worldStore.currentMapId = 'blocked-test-map';
      heroStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };

      const blockedCoord = { columnIndex: 1, rowIndex: 0 };
      const blockedTile = map.tiles.find(
        (t) =>
          t.coordinates.columnIndex === blockedCoord.columnIndex &&
          t.coordinates.rowIndex === blockedCoord.rowIndex,
      )!;
      blockedTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.HOMELAND_GATE, blockedCoord);

      const moved = await heroStore.moveHeroTo(blockedCoord);

      expect(moved).toBe(false);
      expect(heroStore.heroCoordinates).toEqual({ columnIndex: 0, rowIndex: 0 });
    });

    it('rejects moving while a move is already in flight', async () => {
      const worldStore = useWorldMapStore();
      const heroStore = useHeroStore();
      heroStore.hero.id = 'hero-1';
      worldStore.map = buildRevealedMap();
      worldStore.currentMapId = 'busy-test-map';
      heroStore.heroCoordinates = { columnIndex: 0, rowIndex: 0 };
      heroStore.isHeroMoving = true;

      const moved = await heroStore.moveHeroTo({ columnIndex: 1, rowIndex: 0 });

      expect(moved).toBe(false);
    });
  });
});
