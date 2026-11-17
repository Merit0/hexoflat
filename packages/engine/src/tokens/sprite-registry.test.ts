import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { ITEM_TYPES } from '../content/item-types.content';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import type { SpriteManifest } from './sprite-files';
import type { TBaseRealm } from './token-keys';

const PLACEHOLDER = '/hex-assets/items/base/_placeholder.png';

function base(realm: TBaseRealm, type: string, n: string) {
  const key = `${realm}-${type}-${n}`;
  const path = `/hex-assets/items/base/${realm}-${type}/${key}.png`;
  return { key, origin: 'base' as const, realm, type, path };
}

const MANIFEST: SpriteManifest = {
  placeholder: PLACEHOLDER,
  entries: [
    base(ERarityKind.IDOL, 'sword', '01'),
    base(ERarityKind.IDOL, 'sword', '02'),
    base(ERarityKind.GLOOM, 'sword', '01'),
    base(ERarityKind.SPARK, 'shield', '01'),
    {
      key: 'ash-crown-blade',
      origin: 'unique',
      realm: null,
      type: null,
      path: '/hex-assets/items/unique/ash-crown-blade.png',
    },
  ],
};

const sprites = new ManifestSpriteRegistry(MANIFEST);

function keysFor(realm: ERarityKind, type: string, origin: 'base' | 'unique' = 'base') {
  return sprites.spritesFor(origin, realm, type).map((ref) => ref.key);
}

describe('ManifestSpriteRegistry.spritesFor', () => {
  it('returns every sprite of the same realm and type first', () => {
    expect(keysFor(ERarityKind.IDOL, 'sword')).toEqual(['idol-sword-01', 'idol-sword-02']);
  });

  it('falls back to the same type in any realm when the realm has none', () => {
    expect(keysFor(ERarityKind.SPARK, 'sword')).toEqual([
      'idol-sword-01',
      'idol-sword-02',
      'gloom-sword-01',
    ]);
  });

  it('falls back to the placeholder when no realm has the type', () => {
    expect(sprites.spritesFor('base', ERarityKind.IDOL, 'axe')).toEqual([
      { key: '_placeholder', path: PLACEHOLDER },
    ]);
  });

  it('never takes a base sprite for a unique token', () => {
    expect(keysFor(ERarityKind.IDOL, 'sword', 'unique')).toEqual(['_placeholder']);
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
      const [first] = committed.spritesFor('base', ERarityKind.IDOL, type.key);
      expect(first.key).toBe(`idol-${type.key}-01`);
    }
  });
});
