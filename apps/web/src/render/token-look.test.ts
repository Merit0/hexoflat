import { describe, expect, it } from 'vitest';
import { ERarityKind } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { getPrototype } from '@hexoflat/engine';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { SPRITE_MANIFEST } from '@hexoflat/engine/tokens/sprite-manifest';
import { baseTestToken, uniqueTestToken } from '@/test-support/token-fixtures';
import { rarityFrameUrlForKey } from './rarity';
import {
  itemLook,
  itemRarityTone,
  tokenLightColor,
  tokenLightUrl,
  tokenSpriteUrl,
} from './token-look';

const PLACEHOLDER = SPRITE_MANIFEST.placeholder;

describe('item look from a token (LG5c step 1)', () => {
  it('draws a base token with its manifest sprite and the base light of its realm', () => {
    const token = baseTestToken('sword', ERarityKind.IDOL);
    const entry = SPRITE_MANIFEST.entries.find((candidate) => candidate.key === token.sprite);

    expect(entry).toBeDefined();
    expect(tokenSpriteUrl(token)).toBe(entry!.path);
    expect(tokenLightUrl(token)).toBe('/hex-assets/hex-frames/gray-light.png');
    expect(itemLook({ key: K.SWORD, token })).toEqual({
      sprite: entry!.path,
      light: '/hex-assets/hex-frames/gray-light.png',
    });
  });

  it('gives each realm of a base token its own light', () => {
    expect(tokenLightUrl(baseTestToken('shield', ERarityKind.GLOOM))).toBe(
      '/hex-assets/hex-frames/blue-light.png',
    );
    expect(tokenLightUrl(baseTestToken('shield', ERarityKind.SPARK))).toBe(
      '/hex-assets/hex-frames/yellow-light.png',
    );
  });

  it('draws a unique token without a sprite file as the placeholder with the unique light', () => {
    const gloom = uniqueTestToken('lantern-eater');
    const verdict = uniqueTestToken('last-verdict');

    expect(tokenSpriteUrl(gloom)).toBe(PLACEHOLDER);
    expect(tokenLightUrl(gloom)).toBe('/hex-assets/hex-frames/violet-light.png');
    expect(tokenLightUrl(verdict)).toBe('/hex-assets/hex-frames/red-light.png');
    expect(itemRarityTone({ key: K.SWORD, token: verdict })).toBe('god-executor');
    expect(tokenLightColor(gloom)).toBe('#A855F7');
  });

  it('keeps the prototype sprite and light for a stack without a token', () => {
    expect(itemLook({ key: K.COINS })).toEqual({
      sprite: getPrototype(K.COINS).spritePath ?? null,
      light: rarityFrameUrlForKey(K.COINS),
    });
  });
});
