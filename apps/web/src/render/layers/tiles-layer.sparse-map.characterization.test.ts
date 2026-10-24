import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { createTilesLayer, type TilesLayerDeps } from './tiles-layer';

function makeTile(columnIndex: number, rowIndex: number): IHexTile {
  return {
    tileId: `${columnIndex}:${rowIndex}`,
    hexBackgroundImagePath: '',
    isRevealed: true,
    coordinates: { columnIndex, rowIndex },
    coordinatesToString: () => `${columnIndex},${rowIndex}`,
    hexobject: null,
    resourceSpawner: null,
    pendingAction: null,
  };
}

/**
 * C1 boards (docs/WORLD-MAP-BOARDS-PLAN.md §3.5) pass a sparse `tiles` array
 * — fewer entries than `width * height`. syncTiles must create exactly one
 * node per real tile and nothing for the missing (void) coordinates.
 */
describe('tiles-layer sparse map characterization', () => {
  it('creates exactly one node per tile, never one per width x height cell', () => {
    const worldContainer = new Container();
    const deps: TilesLayerDeps = {
      worldContainer,
      getTileSize: () => ({ w: 60, h: 60 }),
      worldStore: {} as TilesLayerDeps['worldStore'],
      combatStore: {} as TilesLayerDeps['combatStore'],
      onTileHover: () => {},
      onTileClick: () => {},
    };

    const layer = createTilesLayer(deps);

    // A 5x5 frame (25 cells) with only 3 real tiles — the other 22 are void.
    const sparseTiles = [makeTile(0, 0), makeTile(4, 4), makeTile(2, 2)];
    layer.syncTiles(sparseTiles);

    expect(layer.container.children).toHaveLength(sparseTiles.length);

    layer.destroy();
  });
});

describe('tiles-layer terrain looks', () => {
  function layerWith(tiles: IHexTile[]) {
    const deps: TilesLayerDeps = {
      worldContainer: new Container(),
      getTileSize: () => ({ w: 60, h: 60 }),
      worldStore: {} as TilesLayerDeps['worldStore'],
      combatStore: {} as TilesLayerDeps['combatStore'],
      onTileHover: () => {},
      onTileClick: () => {},
    };
    const layer = createTilesLayer(deps);
    layer.syncTiles(tiles);
    return layer;
  }

  const fillVisibility = (layer: ReturnType<typeof layerWith>) =>
    layer.container.children.map((root) => root.children[2].visible);

  it('revealed mountain and water tiles use their sprites, never the flat fog fill', () => {
    const ground = makeTile(0, 0);
    const water = { ...makeTile(1, 0), terrain: 'water' as const };
    const mountain = { ...makeTile(2, 0), terrain: 'mountain' as const };

    expect(fillVisibility(layerWith([ground, water, mountain]))).toEqual([false, false, false]);
  });

  it('keeps unrevealed water under the cloud fog without a fill', () => {
    const hidden = { ...makeTile(0, 0), terrain: 'water' as const, isRevealed: false };

    expect(fillVisibility(layerWith([hidden]))).toEqual([false]);
  });

  it('hides unrevealed tiles in the cave under a flat dark fill, and in the world under clouds', () => {
    const hidden = { ...makeTile(0, 0), isRevealed: false };
    const build = (look: 'clouds' | 'dark') => {
      const layer = createTilesLayer({
        worldContainer: new Container(),
        getTileSize: () => ({ w: 60, h: 60 }),
        worldStore: {} as TilesLayerDeps['worldStore'],
        combatStore: {} as TilesLayerDeps['combatStore'],
        onTileHover: () => {},
        onTileClick: () => {},
        getFogLook: () => look,
      });
      layer.syncTiles([hidden]);
      return layer.container.children[0].children[2].visible;
    };

    expect(build('dark')).toBe(true);
    expect(build('clouds')).toBe(false);
  });
});

describe('tiles-layer background path', () => {
  it('a revealed tile with an empty background path falls back to the default instead of loading ""', () => {
    const tiles = [makeTile(0, 0), { ...makeTile(1, 0), terrain: 'water' as const }];
    const layer = createTilesLayer({
      worldContainer: new Container(),
      getTileSize: () => ({ w: 60, h: 60 }),
      worldStore: {} as TilesLayerDeps['worldStore'],
      combatStore: {} as TilesLayerDeps['combatStore'],
      onTileHover: () => {},
      onTileClick: () => {},
    });

    expect(() => layer.syncTiles(tiles)).not.toThrow();
    expect(layer.container.children).toHaveLength(2);
  });
});
