import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { Container } from 'pixi.js';
import { getPrototype } from '@hexoflat/engine';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { HEXOBJECT_KEYS, type THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { createHeroLayer } from './hero-layer';
import { createLootFlightLayer } from './loot-flight-layer';
import { createTilesLayer, EMPTY_CHEST_ALPHA, type TilesLayerDeps } from './tiles-layer';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: () => Texture.EMPTY, onTextureReady: () => () => {} };
});

const SIZE = { w: 60, h: 60 };

function tileWith(key: THexobjectKey | null, columnIndex = 1, rowIndex = 1): IHexTile {
  return {
    tileId: `${columnIndex}:${rowIndex}`,
    hexBackgroundImagePath: '',
    isRevealed: true,
    coordinates: { columnIndex, rowIndex },
    coordinatesToString: () => `${columnIndex},${rowIndex}`,
    hexobject: key ? { ...getPrototype(key), id: `o-${key}` } : null,
    resourceSpawner: null,
    pendingAction: null,
  };
}

function tilesLayerOn(world: Container, extra: Partial<TilesLayerDeps> = {}) {
  return createTilesLayer({
    worldContainer: world,
    getTileSize: () => SIZE,
    worldStore: {} as TilesLayerDeps['worldStore'],
    onTileHover: () => {},
    onTileClick: () => {},
    ...extra,
  });
}

function spriteOf(layer: ReturnType<typeof createTilesLayer>) {
  const root = layer.container.children[0];
  return root.children[3];
}

describe('chest sprites', () => {
  it('draws the opened chest with the closed sprite, dimmed', () => {
    const layer = tilesLayerOn(new Container());
    layer.syncTiles([tileWith(HEXOBJECT_KEYS.CHEST_OPEN)]);
    expect(spriteOf(layer).alpha).toBe(EMPTY_CHEST_ALPHA);
    layer.syncTiles([tileWith(HEXOBJECT_KEYS.CHEST)]);
    expect(spriteOf(layer).alpha).toBe(1);
    layer.destroy();
  });

  it('keeps the sprite of an item hidden while its flight is still on the way', () => {
    let hidden = true;
    const layer = tilesLayerOn(new Container(), { isObjectHidden: () => hidden });
    const tile = tileWith(HEXOBJECT_KEYS.COINS);
    layer.syncTiles([tile]);
    expect(spriteOf(layer).alpha).toBe(0);
    hidden = false;
    layer.syncTiles([tile], new Set(['1:1']));
    expect(spriteOf(layer).alpha).toBe(1);
    layer.destroy();
  });
});

describe('layer order', () => {
  it('stacks tiles, then the hero, then loot in flight, in the order the layers are created', () => {
    const world = new Container();
    const tiles = tilesLayerOn(world);
    const hero = createHeroLayer({ worldContainer: world, getTileSize: () => SIZE });
    const flight = createLootFlightLayer({
      worldContainer: world,
      getTileSize: () => SIZE,
      onLanded: () => {},
    });

    expect(world.children).toHaveLength(3);
    expect(world.children[0]).toBe(tiles.container);
    expect(world.children[1]).not.toBe(tiles.container);

    flight.destroy();
    hero.destroy();
    tiles.destroy();
  });

  it('the board creates them in that order, so the hero token draws above the chest', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/render/use-hex-board.ts'), 'utf-8');
    const tiles = source.indexOf('createTilesLayer({');
    const hero = source.indexOf('createHeroLayer({');
    const flight = source.indexOf('createLootFlightLayer({');
    expect(tiles).toBeGreaterThan(-1);
    expect(hero).toBeGreaterThan(tiles);
    expect(flight).toBeGreaterThan(hero);
  });
});
