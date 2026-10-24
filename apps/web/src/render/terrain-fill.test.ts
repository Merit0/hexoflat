import { describe, expect, it } from 'vitest';
import { TERRAIN_IDS } from '@hexoflat/engine/boards/terrain';
import { terrainFillColor } from './terrain-fill';

describe('terrainFillColor', () => {
  it('leaves ground to its texture and gives every other terrain its own flat colour', () => {
    expect(terrainFillColor('ground')).toBeNull();
    expect(terrainFillColor(undefined)).toBeNull();

    const colours = TERRAIN_IDS.filter((id) => id !== 'ground').map((id) => terrainFillColor(id));
    expect(colours.every((colour) => typeof colour === 'number')).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });
});
