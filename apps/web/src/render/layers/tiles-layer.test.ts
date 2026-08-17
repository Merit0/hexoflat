import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { createPinia, setActivePinia } from 'pinia';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import type { DiscoveryState } from '@hexoflat/engine';
import { createTilesLayer, type TilesLayerDeps } from '@/render/layers/tiles-layer';

/**
 * "No UNKNOWN hex is rendered" (invariant I13), asserted on the scene graph
 * itself rather than on the array that feeds it.
 *
 * The layer creates exactly one child container per tile it is handed, so the
 * child count *is* the number of tiles on screen. Counting them here catches
 * the case the composable test cannot: a future caller handing the layer the
 * unfiltered list.
 */

// The real cache reaches for `Assets.load`, which needs a GPU renderer. The
// layer under test only cares that it got *a* texture back, so the empty one
// is a faithful stand-in.
vi.mock('@/render/texture-cache', async () => {
  const { Texture: PixiTexture } = await vi.importActual<typeof import('pixi.js')>('pixi.js');
  return {
    getTexture: () => PixiTexture.EMPTY,
    onTextureReady: () => () => {},
  };
});

function tile(columnIndex: number, rowIndex: number, discovery: DiscoveryState): IHexTile {
  return {
    tileId: `${columnIndex}:${rowIndex}`,
    hexBackgroundImagePath: '/hex-assets/ground.png',
    discovery,
    get isRevealed() {
      return discovery !== 'UNKNOWN';
    },
    coordinates: { columnIndex, rowIndex },
    coordinatesToString: () => `${columnIndex},${rowIndex}`,
    hexobject: null,
    resourceSpawner: null,
    pendingAction: null,
  };
}

function makeLayer() {
  const worldContainer = new Container();
  const deps = {
    worldContainer,
    getTileSize: () => ({ w: 100, h: 100 }),
    worldStore: { getLocationRespawnRemainingMs: () => 0 },
    combatStore: { combatMarkers: [] },
    onTileHover: vi.fn(),
    onTileClick: vi.fn(),
  } as unknown as TilesLayerDeps;

  return createTilesLayer(deps);
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('tiles-layer node count', () => {
  it('draws one node per tile it is handed', () => {
    const layer = makeLayer();

    layer.syncTiles([tile(0, 0, 'DISCOVERED'), tile(1, 0, 'OBSERVED')]);

    expect(layer.container.children).toHaveLength(2);
  });

  it('renders nothing for a board whose known island is empty', () => {
    const layer = makeLayer();

    layer.syncTiles([]);

    expect(layer.container.children).toHaveLength(0);
  });

  it('destroys the node for a tile that leaves the visible set', () => {
    // The organic frontier only ever grows, but a location switch replaces
    // the whole board — the prune path is what keeps the previous world's
    // hexes from lingering on screen.
    const layer = makeLayer();
    layer.syncTiles([tile(0, 0, 'DISCOVERED'), tile(1, 0, 'DISCOVERED')]);

    layer.syncTiles([tile(0, 0, 'DISCOVERED')]);

    expect(layer.container.children).toHaveLength(1);
  });

  it('adds a node when the frontier grows', () => {
    const layer = makeLayer();
    layer.syncTiles([tile(0, 0, 'DISCOVERED')]);

    layer.syncTiles([tile(0, 0, 'DISCOVERED'), tile(1, 0, 'OBSERVED')]);

    expect(layer.container.children).toHaveLength(2);
  });
});

describe('OBSERVED is drawn as a silhouette, not as terrain', () => {
  it('dims an observed tile and leaves a discovered one at full opacity', () => {
    const layer = makeLayer();

    layer.syncTiles([tile(0, 0, 'DISCOVERED'), tile(1, 0, 'OBSERVED')]);

    const [discovered, observed] = layer.container.children;
    expect(discovered.alpha).toBe(1);
    expect(observed.alpha).toBeLessThan(1);
  });

  it('restores full opacity when an observed tile becomes discovered', () => {
    const layer = makeLayer();
    layer.syncTiles([tile(0, 0, 'OBSERVED')]);

    layer.syncTiles([tile(0, 0, 'DISCOVERED')]);

    expect(layer.container.children[0].alpha).toBe(1);
  });

  it('leaves UNDERSTOOD at full opacity', () => {
    const layer = makeLayer();

    layer.syncTiles([tile(0, 0, 'UNDERSTOOD')]);

    expect(layer.container.children[0].alpha).toBe(1);
  });
});
