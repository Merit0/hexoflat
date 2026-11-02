import { describe, expect, it } from 'vitest';
import { BATTLE_GRAVE_SPRITES, battleAssetPaths } from './battle-look';

describe('battleAssetPaths', () => {
  it('preloads the skeleton grave so it is on screen the moment the skeleton falls', () => {
    expect(battleAssetPaths('crypt')).toContain(BATTLE_GRAVE_SPRITES.enemies);
  });

  it('keeps the grave sprite under the public enemy constructs folder', () => {
    expect(BATTLE_GRAVE_SPRITES.enemies).toBe(
      '/hex-assets/hex-constructs/enemy-constructs/skeleton-grave-token.png',
    );
  });

  it('never lists an empty path', () => {
    expect(battleAssetPaths('crypt').every((path) => path.length > 0)).toBe(true);
  });
});
