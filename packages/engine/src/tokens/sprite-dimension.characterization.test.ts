import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { EDimension, tokenTypeOfDimension } from '../dimensions/dimensions';
import { createTokenFactory } from './factory/create-token-factory';
import { TypeRegistry } from './registries';
import { buildSpriteManifest } from './sprite-files';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import { cleanSpriteFiles, spriteFile } from './sprite-test-setup';

const factory = createTokenFactory();
const registry = new ManifestSpriteRegistry(SPRITE_MANIFEST);
const TYPES = ITEM_TYPES.map((type) => type.key);

describe('DA2 B6: base sprites of gloom and spark tokens', () => {
  it('CURRENT (B6): the manifest holds only idol base folders', () => {
    const tokenTypes = new Set(
      SPRITE_MANIFEST.entries.filter((entry) => entry.tier === 'base').map((e) => e.tokenType),
    );
    expect([...tokenTypes]).toEqual([ETokenType.IDOL]);
  });

  it.each([ETokenType.GLOOM, ETokenType.SPARK])(
    'CURRENT (B6): %s base sprites fall back to the idol sprite of the same type',
    (tokenType) => {
      for (const type of TYPES) {
        const sprites = registry.spritesFor('base', tokenType, type);
        expect(sprites.length).toBeGreaterThan(0);
        for (const sprite of sprites)
          expect(sprite.key).toMatch(new RegExp(`^idol-${type}-\\d{2}$`));
      }
    },
  );

  it.each([EDimension.UNDERWORLD, EDimension.HEAVEN])(
    'CURRENT (B6): a generated %s base token uses an idol sprite',
    (dimension) => {
      for (const [index, type] of TYPES.entries()) {
        const made = factory.createBase({
          seed: `da2-b6-${index}`,
          sourceId: 'test:da2.b6',
          n: index,
          tokenType: tokenTypeOfDimension(dimension),
          mapTier: 1,
          type,
        });
        if (!made.ok) throw new Error(made.refusal.code);
        expect(made.value.dimension).toBe(dimension);
        expect(made.value.sprite).toMatch(new RegExp(`^idol-${type}-\\d{2}$`));
      }
    },
  );
});

describe('DA2 C5: the sprite validator refuses a base Alien path', () => {
  it.each(['base/alien-sword/alien-sword-01.png', 'base/alien-shield/alien-shield-07.png'])(
    'C5: %s is refused with ALIEN_IN_BASE and no manifest is written',
    (path) => {
      const result = buildSpriteManifest(
        [...cleanSpriteFiles(), spriteFile(path)],
        new TypeRegistry(ITEM_TYPES),
      );
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.failures.map((f) => [f.code, f.path])).toEqual([['ALIEN_IN_BASE', path]]);
    },
  );
});
