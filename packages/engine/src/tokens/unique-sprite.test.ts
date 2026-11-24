import { describe, expect, it } from 'vitest';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { ManifestSpriteRegistry } from './sprite-registry';
import { uniqueSpriteKey } from './unique-schema';

const WITH_UNIQUE = {
  ...SPRITE_MANIFEST,
  entries: [
    ...SPRITE_MANIFEST.entries,
    {
      key: 'last-verdict',
      tier: 'unique' as const,
      tokenType: null,
      type: null,
      path: '/hex-assets/items/unique/last-verdict.png',
    },
  ],
};

describe('unique sprites', () => {
  const sprites = new ManifestSpriteRegistry(WITH_UNIQUE);

  it('names the sprite after the unique key', () => {
    expect(uniqueSpriteKey('last-verdict')).toBe('last-verdict');
  });

  it('finds the unique sprite in the manifest, else the placeholder', () => {
    expect(sprites.uniqueSprite('last-verdict').key).toBe('last-verdict');
    expect(sprites.uniqueSprite('lantern-eater')).toEqual(sprites.placeholder);
  });
});
