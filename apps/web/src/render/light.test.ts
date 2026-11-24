import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { LIGHT_NAME_FRAME_URLS, lightFrameUrlForKey } from './light';

describe('lightFrameUrlForKey', () => {
  it('gives a pickable tool the same light frame the map draws under it', () => {
    expect(lightFrameUrlForKey(HEXOBJECT_KEYS.AXE)).toMatch(
      /\/hex-assets\/hex-frames\/.+-light\.png$/,
    );
  });

  it('gives camp gear the gray idol light and the return scroll the yellow spark light', () => {
    expect(lightFrameUrlForKey(HEXOBJECT_KEYS.SWORD)).toBe('/hex-assets/hex-frames/gray-light.png');
    expect(lightFrameUrlForKey(HEXOBJECT_KEYS.RETURN_SCROLL)).toBe(
      '/hex-assets/hex-frames/yellow-light.png',
    );
  });

  it('has a sprite file on disk for every tone', () => {
    for (const url of Object.values(LIGHT_NAME_FRAME_URLS)) {
      expect(existsSync(resolve(__dirname, '../../public', `.${url}`))).toBe(true);
    }
  });

  it('gives loot without a tokenType no frame, matching the map', () => {
    expect(lightFrameUrlForKey(HEXOBJECT_KEYS.COINS)).toBeNull();
  });
});
