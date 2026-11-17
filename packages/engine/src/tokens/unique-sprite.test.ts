import { describe, expect, it } from 'vitest';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import { uniqueSpriteKey } from './unique-schema';

const WITH_UNIQUE = {
  ...SPRITE_MANIFEST,
  entries: [
    ...SPRITE_MANIFEST.entries,
    {
      key: 'unique-last-verdict',
      origin: 'unique' as const,
      realm: null,
      type: null,
      path: '/hex-assets/items/unique/unique-last-verdict.png',
    },
  ],
};

describe('unique sprites', () => {
  const sprites = new ManifestSpriteRegistry(WITH_UNIQUE);

  it('names the sprite unique-<uniqueKey>', () => {
    expect(uniqueSpriteKey('last-verdict')).toBe('unique-last-verdict');
  });

  it('finds the unique sprite in the manifest, else the placeholder', () => {
    expect(sprites.uniqueSprite('last-verdict').key).toBe('unique-last-verdict');
    expect(sprites.uniqueSprite('lantern-eater')).toEqual(sprites.placeholder);
  });

  it('lists the uniques without a sprite', () => {
    expect(sprites.missingUniqueSprites(['last-verdict', 'lantern-eater'])).toEqual([
      'lantern-eater',
    ]);
  });
});
