import { describe, expect, it } from 'vitest';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import { assembleWorld } from './world-map-assembler';
import { DEFAULT_WORLD_MAP_CONFIG } from './world-map-config';
import { placePromises } from './world-map-promises';

function seams(seed: string) {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags: ['BRANCH', 'OPEN_AREA', 'CHOKEPOINT', 'POCKET'],
    maxSections: 5,
  });
  return { openSeams: world.openSeams, campAnchor: world.placedSections[0].anchor };
}

describe('placePromises', () => {
  it('is deterministic for a given seed', () => {
    const { openSeams, campAnchor } = seams('p1');
    const a = placePromises(openSeams, campAnchor, 'p1', DEFAULT_WORLD_MAP_CONFIG);
    const b = placePromises(openSeams, campAnchor, 'p1', DEFAULT_WORLD_MAP_CONFIG);
    expect(a).toEqual(b);
  });

  it.each(['a', 'b', 'c', 'd', 'e', 'f'])(
    'respects config bounds and always has a strong-ish one (%s)',
    (seed) => {
      const { openSeams, campAnchor } = seams(seed);
      const promises = placePromises(openSeams, campAnchor, seed, DEFAULT_WORLD_MAP_CONFIG);

      expect(promises.length).toBeGreaterThanOrEqual(
        Math.min(DEFAULT_WORLD_MAP_CONFIG.requiredPromises, openSeams.length),
      );
      expect(promises.length).toBeLessThanOrEqual(DEFAULT_WORLD_MAP_CONFIG.maxPromises);
      expect(promises.length).toBeLessThanOrEqual(openSeams.length);
      expect(promises.some((p) => p.strength !== 'SUBTLE')).toBe(true);
    },
  );

  it('places every promise on one of the open seams', () => {
    const { openSeams, campAnchor } = seams('g');
    const seamKeys = new Set(
      openSeams.map((s) => `${s.coord.columnIndex}:${s.coord.rowIndex}:${s.dir}`),
    );

    for (const p of placePromises(openSeams, campAnchor, 'g', DEFAULT_WORLD_MAP_CONFIG)) {
      expect(
        seamKeys.has(`${p.seam.coord.columnIndex}:${p.seam.coord.rowIndex}:${p.seam.dir}`),
      ).toBe(true);
    }
  });

  it('returns nothing when there are no open seams', () => {
    expect(
      placePromises([], { columnIndex: 0, rowIndex: 0 }, 'x', DEFAULT_WORLD_MAP_CONFIG),
    ).toEqual([]);
  });
});
