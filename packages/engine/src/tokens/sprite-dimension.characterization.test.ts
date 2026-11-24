import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { EDimension, tokenTypeOfDimension } from '../dimensions/dimensions';
import { createTokenFactory } from './factory/create-token-factory';
import { LIGHT_COLOR_BY_TONE, lightTone } from './light-tone';
import { setSpriteFallbackLog } from './sprite-fallback-log';
import { buildSpriteManifest } from './sprite-files';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import { cleanSpriteFiles, spriteCatalogue, spriteFile } from './sprite-test-setup';

const factory = createTokenFactory();
const registry = new ManifestSpriteRegistry(SPRITE_MANIFEST);
const TYPES = ITEM_TYPES.map((type) => type.key);

describe('DA4 B6: base sprites of gloom and spark tokens', () => {
  const warnings: string[] = [];

  beforeEach(() => {
    warnings.length = 0;
    setSpriteFallbackLog((message) => warnings.push(message));
  });

  afterEach(() => setSpriteFallbackLog(null));

  function made(dimension: EDimension, type: string, n: number) {
    const result = factory.createBase({
      seed: `da4-b6-${n}`,
      sourceId: 'test:da4.b6',
      n,
      tokenType: tokenTypeOfDimension(dimension),
      mapTier: 1,
      type,
    });
    if (!result.ok) throw new Error(result.refusal.code);
    return result.value;
  }

  it('the manifest holds only idol base folders', () => {
    const tokenTypes = new Set(
      SPRITE_MANIFEST.entries.filter((entry) => entry.tier === 'base').map((e) => e.tokenType),
    );
    expect([...tokenTypes]).toEqual([ETokenType.IDOL]);
  });

  it.each([ETokenType.GLOOM, ETokenType.SPARK])(
    '%s without an own sprite borrows the idol sprite of the same type',
    (tokenType) => {
      for (const type of TYPES) {
        const resolution = registry.resolveBase(tokenType, type);
        expect([resolution.step, resolution.from]).toEqual(['borrowed', ETokenType.IDOL]);
        expect(resolution.refs.map((ref) => ref.key)).toEqual([`idol-${type}-01`]);
      }
    },
  );

  it.each([
    [EDimension.UNDERWORLD, 'gloom-base', 'blue'],
    [EDimension.HEAVEN, 'spark-base', 'yellow'],
  ] as const)(
    'a generated %s sword has the idol sprite, its own %s light and one dev warning',
    (dimension, tone, light) => {
      for (let n = 0; n < 5; n += 1) {
        const token = made(dimension, 'sword', n);
        expect(token.dimension).toBe(dimension);
        expect(token.sprite).toBe('idol-sword-01');
        expect(lightTone(token.tier, token.tokenType)).toBe(tone);
        expect(LIGHT_COLOR_BY_TONE[lightTone(token.tier, token.tokenType)]).toBe(light);
      }
      expect(warnings).toEqual([
        `[sprites] base/${tokenTypeOfDimension(dimension)}-sword has no sprite, idol-sword is used`,
      ]);
    },
  );

  it('warns once per token type and item type, never for an own sprite', () => {
    for (const dimension of [EDimension.UNDERWORLD, EDimension.HEAVEN, EDimension.EARTH]) {
      for (const n of [0, 1]) for (const type of TYPES) made(dimension, type, n);
    }
    expect(warnings).toHaveLength(2 * TYPES.length);
    expect(new Set(warnings).size).toBe(warnings.length);
    expect(warnings.some((message) => message.includes('base/idol-'))).toBe(false);
  });

  it('is silent without a log (production)', () => {
    setSpriteFallbackLog(null);
    const spy = vi.spyOn(console, 'warn');
    made(EDimension.UNDERWORLD, 'sword', 0);
    expect(warnings).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('DA2 C5: the sprite validator refuses a base Alien path', () => {
  it.each(['base/alien-sword/alien-sword-01.png', 'base/alien-shield/alien-shield-07.png'])(
    'C5: %s is refused with ALIEN_IN_BASE and no manifest is written',
    (path) => {
      const result = buildSpriteManifest(
        [...cleanSpriteFiles(), spriteFile(path)],
        spriteCatalogue(),
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.failures.map((f) => [f.code, f.path])).toEqual([['ALIEN_IN_BASE', path]]);
    },
  );
});
