import { describe, expect, it } from 'vitest';
import { resolveTokenSprite } from './sprite-fallback';
import { SPRITE_MANIFEST } from './sprite-manifest';
import { uniqueSpriteKey } from './token-keys';
import { defaultFactory } from './factory/factory-test-setup';

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

function unique(key: string) {
  const made = defaultFactory.createUnique(key, {
    seed: 'unique-sprite',
    sourceId: 'test:unique.sprite',
    n: 0,
    mapTier: 1,
    ownedUniques: [],
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('unique sprites', () => {
  it('names the sprite after the unique key', () => {
    expect(uniqueSpriteKey('last-verdict')).toBe('last-verdict');
  });

  it('never stores the sprite on the token', () => {
    expect(unique('last-verdict')).not.toHaveProperty('sprite');
  });

  it('derives the sprite from the template key when the token is drawn', () => {
    const token = unique('last-verdict');
    expect(resolveTokenSprite(SPRITE_MANIFEST, token).key).toBe('_placeholder');
    expect(resolveTokenSprite(WITH_UNIQUE, token).key).toBe('last-verdict');
    expect(resolveTokenSprite(WITH_UNIQUE, unique('lantern-eater')).key).toBe('_placeholder');
  });
});
