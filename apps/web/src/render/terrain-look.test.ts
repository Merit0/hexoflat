import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { TERRAIN_IDS } from '@hexoflat/engine/boards/terrain';
import { terrainLook } from './terrain-look';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');

describe('terrainLook', () => {
  it('leaves ground to the tile texture and gives every other terrain a look', () => {
    expect(terrainLook('ground')).toBeNull();
    expect(terrainLook(undefined)).toBeNull();
    for (const id of TERRAIN_IDS.filter((terrain) => terrain !== 'ground')) {
      expect(terrainLook(id), id).not.toBeNull();
    }
  });

  it('draws mountains with the rock sprite and water with the water hex', () => {
    expect(terrainLook('mountain')?.sprite).toBe('/hex-assets/hex-resources/rock-token-image.png');
    expect(terrainLook('water')?.background).toBe('/hex-assets/board-hexes/water-hex.png');
    expect(terrainLook('water')?.sprite).toBeNull();
  });

  it('only points at sprite files that exist in public/', () => {
    for (const id of TERRAIN_IDS) {
      const look = terrainLook(id);
      for (const url of [look?.background, look?.sprite]) {
        if (url) expect(existsSync(path.join(PUBLIC_DIR, url)), url).toBe(true);
      }
    }
  });
});
