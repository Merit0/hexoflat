import { describe, expect, it } from 'vitest';
import { coordinateKey } from '../utils/hex-utils';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import { assembleWorld, type AssembledWorld } from './world-map-assembler';
import { DEFAULT_WORLD_MAP_CONFIG } from './world-map-config';
import { validateWorld } from './world-map-validator';

function build(seed = 'validator'): {
  world: AssembledWorld;
  campAnchor: { columnIndex: number; rowIndex: number };
} {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags: ['BRANCH', 'OPEN_AREA', 'CHOKEPOINT', 'POCKET'],
    maxSections: 5,
  });
  return { world, campAnchor: world.placedSections[0].anchor };
}

describe('validateWorld', () => {
  it('accepts a well-formed FORKED_FRONTIER world with no reasons', () => {
    const { world, campAnchor } = build('good-seed');
    const result = validateWorld(world, campAnchor, DEFAULT_WORLD_MAP_CONFIG);

    expect(result.rejectionReasons).toEqual([]);
    expect(result.accepted).toBe(true);
  });

  it('flags asymmetry when the threshold is impossible', () => {
    const { world, campAnchor } = build('sym');
    const result = validateWorld(world, campAnchor, {
      ...DEFAULT_WORLD_MAP_CONFIG,
      symmetryRejectThreshold: 999,
    });

    expect(result.accepted).toBe(false);
    expect(result.rejectionReasons.some((r) => r.startsWith('asymmetry'))).toBe(true);
  });

  it('flags tag coverage when a required section is missing', () => {
    const { world, campAnchor } = build('tags');
    world.placedSections = world.placedSections.filter((p) => !p.tags.includes('POCKET'));

    const result = validateWorld(world, campAnchor, DEFAULT_WORLD_MAP_CONFIG);
    expect(result.rejectionReasons.some((r) => r.startsWith('tag-coverage'))).toBe(true);
  });

  it('flags connectivity when a passable tile is walled off', () => {
    const { world, campAnchor } = build('conn');
    for (const tile of world.map.tiles) {
      const k = coordinateKey(tile.coordinates);
      if (k === coordinateKey(campAnchor)) continue;
      world.terrainByCoord[k] = 'STONE_RIDGE';
    }
    // one lone open tile far from camp
    world.terrainByCoord[coordinateKey(world.map.tiles[world.map.tiles.length - 1].coordinates)] =
      'OPEN_GROUND';

    const result = validateWorld(world, campAnchor, DEFAULT_WORLD_MAP_CONFIG);
    expect(result.rejectionReasons.some((r) => r.startsWith('connectivity'))).toBe(true);
  });

  it('flags no-lock-in when every camp-anchor neighbour is blocked', () => {
    const { world, campAnchor } = build('lock');
    for (const tile of world.map.tiles) {
      if (coordinateKey(tile.coordinates) === coordinateKey(campAnchor)) continue;
      world.terrainByCoord[coordinateKey(tile.coordinates)] = 'STONE_RIDGE';
    }

    const result = validateWorld(world, campAnchor, DEFAULT_WORLD_MAP_CONFIG);
    expect(result.rejectionReasons.some((r) => r.startsWith('no-lock-in'))).toBe(true);
  });
});
