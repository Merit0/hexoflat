import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import type { SpriteManifest } from './sprite-files';
import type { TBaseTokenType } from './token-keys';

const PLACEHOLDER = '/hex-assets/items/base/_placeholder.png';

function base(tokenType: TBaseTokenType, type: string, n: string) {
  const key = `${tokenType}-${type}-${n}`;
  const path = `/hex-assets/items/base/${tokenType}-${type}/${key}.png`;
  return { key, tier: 'base' as const, tokenType, type, path };
}

const MANIFEST: SpriteManifest = {
  placeholder: PLACEHOLDER,
  entries: [
    base(ETokenType.IDOL, 'sword', '01'),
    base(ETokenType.IDOL, 'sword', '02'),
    base(ETokenType.GLOOM, 'sword', '01'),
    base(ETokenType.SPARK, 'shield', '01'),
    {
      key: 'ash-crown-blade',
      tier: 'unique',
      tokenType: null,
      type: null,
      path: '/hex-assets/items/unique/ash-crown-blade.png',
    },
  ],
};

const sprites = new ManifestSpriteRegistry(MANIFEST);

function keysFor(tokenType: ETokenType, type: string, tier: 'base' | 'unique' = 'base') {
  return sprites.spritesFor(tier, tokenType, type).map((ref) => ref.key);
}

describe('ManifestSpriteRegistry.spritesFor', () => {
  it('returns every sprite of the same tokenType and type first', () => {
    expect(keysFor(ETokenType.IDOL, 'sword')).toEqual(['idol-sword-01', 'idol-sword-02']);
  });

  it('falls back to the same type in any tokenType when the tokenType has none', () => {
    expect(keysFor(ETokenType.SPARK, 'sword')).toEqual([
      'idol-sword-01',
      'idol-sword-02',
      'gloom-sword-01',
    ]);
  });

  it('falls back to the placeholder when no tokenType has the type', () => {
    expect(sprites.spritesFor('base', ETokenType.IDOL, 'axe')).toEqual([
      { key: '_placeholder', path: PLACEHOLDER },
    ]);
  });

  it('never takes a base sprite for a unique token', () => {
    expect(keysFor(ETokenType.IDOL, 'sword', 'unique')).toEqual(['_placeholder']);
  });

  it('keeps the data it was given and refuses a broken manifest', () => {
    expect(sprites.all()).toEqual(MANIFEST.entries);
    expect(() => new ManifestSpriteRegistry({ ...MANIFEST, placeholder: 'x.png' })).toThrow();
  });
});

describe('SPRITE_MANIFEST (generated)', () => {
  it('has an own idol sprite for every item type', () => {
    const committed = new ManifestSpriteRegistry(SPRITE_MANIFEST);
    for (const type of ITEM_TYPES) {
      const [first] = committed.spritesFor('base', ETokenType.IDOL, type.key);
      expect(first.key).toBe(`idol-${type.key}-01`);
    }
  });
});
