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

describe('tiles-layer background path', () => {
  it('a revealed tile with an empty background path falls back to the default instead of loading ""', () => {
    const tiles = [makeTile(0, 0), { ...makeTile(1, 0), terrain: 'water' as const }];
    const layer = createTilesLayer({
      worldContainer: new Container(),
      getTileSize: () => ({ w: 60, h: 60 }),
      worldStore: {} as TilesLayerDeps['worldStore'],
      onTileHover: () => {},
      onTileClick: () => {},
    });

    expect(() => layer.syncTiles(tiles)).not.toThrow();
    expect(layer.container.children).toHaveLength(2);
  });
});

describe('tiles-layer hidden tiles', () => {
  function hiddenLayer(look: 'clouds' | 'mist') {
    const layer = createTilesLayer({
      worldContainer: new Container(),
      getTileSize: () => ({ w: 60, h: 60 }),
      worldStore: {} as TilesLayerDeps['worldStore'],
      onTileHover: () => {},
      onTileClick: () => {},
      getFogLook: () => look,
    });
    layer.syncTiles([{ ...makeTile(0, 0), isRevealed: false }]);
    return layer;
  }

  it('builds a hidden tile for each look without throwing, one node per tile', () => {
    expect(hiddenLayer('clouds').container.children).toHaveLength(1);
    expect(hiddenLayer('mist').container.children).toHaveLength(1);
  });
});
