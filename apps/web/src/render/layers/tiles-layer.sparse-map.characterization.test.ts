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
