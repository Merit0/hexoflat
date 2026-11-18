import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container, Texture } from 'pixi.js';
import { HexObjectFactory } from '@hexoflat/engine/factory/hex-object-factory';
import type { IHexTile } from '@hexoflat/engine/map/models/hex-tile-model';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
import { createTilesLayer, type TilesLayerDeps } from './tiles-layer';

const requested = vi.hoisted(() => [] as string[]);

vi.mock('@/render/texture-cache', () => ({
  getTexture: (path: string) => {
    requested.push(path);
    return Texture.EMPTY;
  },
  onTextureReady: () => () => {},
}));

function tileWith(token: ItemToken): IHexTile {
  const coordinates = { columnIndex: 0, rowIndex: 0 };
  const hexobject = HexObjectFactory.create(token.type as typeof K.SWORD, coordinates);
  return {
    tileId: '0:0',
    hexBackgroundImagePath: '',
    isRevealed: true,
    coordinates,
    coordinatesToString: () => '0,0',
    hexobject: { ...hexobject, token },
    resourceSpawner: null,
    pendingAction: null,
  };
}

function drawn(token: ItemToken): string[] {
  requested.length = 0;
  const layer = createTilesLayer({
    worldContainer: new Container(),
    getTileSize: () => ({ w: 60, h: 60 }),
    worldStore: {} as TilesLayerDeps['worldStore'],
    onTileHover: () => {},
    onTileClick: () => {},
  });
  layer.syncTiles([tileWith(token)]);
  layer.destroy();
  return [...requested];
}

describe('tiles layer draws an item token on the map (LG5c step 1)', () => {
  beforeEach(() => {
    requested.length = 0;
  });

  it('loads the manifest sprite and the base light of a base token', () => {
    const token = baseTestToken('sword');
    const sprite = SPRITE_MANIFEST.entries.find((entry) => entry.key === token.sprite)!.path;

    const paths = drawn(token);

    expect(paths).toContain(sprite);
    expect(paths).toContain('/hex-assets/hex-frames/gray-light.png');
    expect(paths).not.toContain('/hex-assets/hex-loot/sword-hex.png');
  });

  it('loads the placeholder and the unique light of a unique token without a sprite', () => {
    const paths = drawn(uniqueTestToken('lantern-eater'));

    expect(paths).toContain(SPRITE_MANIFEST.placeholder);
    expect(paths).toContain('/hex-assets/hex-frames/violet-light.png');
  });
});
