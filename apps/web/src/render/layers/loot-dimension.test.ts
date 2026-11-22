import { Container } from 'pixi.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
import { tokenLightUrl, tokenSpriteUrl } from '@/render/token-look';
import { EMPTY_FIELD } from '@/services/quests/quest-field-model';
import { getTexture, onTextureReady } from '@/render/texture-cache';
import { createBattleLootLayer } from './battle-loot-layer';
import { createQuestNumbersLayer } from './quest-numbers-layer';

vi.mock('@/render/texture-cache', async () => {
  const { Texture } = await import('pixi.js');
  return { getTexture: vi.fn(() => Texture.EMPTY), onTextureReady: vi.fn(() => vi.fn()) };
});

beforeEach(() => vi.clearAllMocks());

describe('loot sprites retain token ownership', () => {
  it.each([ERarityKind.GLOOM, ERarityKind.SPARK])(
    'draws %s battle loot using its stored sprite and light',
    (realm) => {
      const token = baseTestToken('sword', realm);
      const world = new Container();
      const layer = createBattleLootLayer({
        worldContainer: world,
        tileSize: { w: 60, h: 54 },
        positionOf: () => ({ x: 0, y: 0 }),
        isHidden: () => false,
      });
      layer.sync([{ hex: { q: 0, r: 0 }, itemKey: 'sword', amount: 1, token }]);
      expect(getTexture).toHaveBeenCalledWith(tokenSpriteUrl(token));
      expect(getTexture).toHaveBeenCalledWith(tokenLightUrl(token));
      const stops = vi
        .mocked(onTextureReady)
        .mock.results.map((result) => result.value as ReturnType<typeof vi.fn>);
      layer.destroy();
      for (const stop of stops) expect(stop).toHaveBeenCalledOnce();
      world.destroy({ children: true });
    },
  );

  it('updates quest loot when the concrete token changes but its generic key stays the same', () => {
    const world = new Container();
    const layer = createQuestNumbersLayer({
      worldContainer: world,
      tileSize: { w: 60, h: 54 },
      positionOf: () => ({ x: 0, y: 0 }),
      floorSprite: 'floor.png',
    });
    const hex = { columnIndex: 1, rowIndex: 1 };
    const base = baseTestToken('sword', ERarityKind.GLOOM);
    const alien = uniqueTestToken('last-verdict');
    for (const token of [base, alien]) {
      layer.sync({
        ...EMPTY_FIELD,
        collect: true,
        ground: [{ hex, itemKey: 'sword', amount: 1, token }],
      });
      expect(getTexture).toHaveBeenCalledWith(tokenSpriteUrl(token));
      expect(getTexture).toHaveBeenCalledWith(tokenLightUrl(token));
    }
    layer.destroy();
    world.destroy({ children: true });
  });

  it('keeps hidden loot hidden and gives coins no rarity light', () => {
    const world = new Container();
    let hidden = true;
    const layer = createBattleLootLayer({
      worldContainer: world,
      tileSize: { w: 60, h: 54 },
      positionOf: () => ({ x: 0, y: 0 }),
      isHidden: () => hidden,
    });
    layer.sync([{ hex: { q: 0, r: 0 }, itemKey: 'coins', amount: 5 }]);
    expect(getTexture).not.toHaveBeenCalled();
    hidden = false;
    layer.refresh();
    expect(vi.mocked(getTexture).mock.calls).toHaveLength(1);
    expect(vi.mocked(getTexture).mock.calls[0][0]).not.toContain('-light');
    layer.destroy();
    world.destroy({ children: true });
  });
});
