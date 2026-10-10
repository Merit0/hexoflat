import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { rarityFrameUrlForKey } from './rarity';

describe('rarityFrameUrlForKey', () => {
  it('gives a pickable tool the same light frame the map draws under it', () => {
    expect(rarityFrameUrlForKey(HEXOBJECT_KEYS.AXE)).toMatch(
      /\/hex-assets\/hex-frames\/.+-light\.png$/,
    );
  });

  it('gives loot without a rarity no frame, matching the map', () => {
    expect(rarityFrameUrlForKey(HEXOBJECT_KEYS.COINS)).toBeNull();
  });
});
