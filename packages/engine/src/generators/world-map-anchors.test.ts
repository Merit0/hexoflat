import { describe, expect, it } from 'vitest';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import { assembleWorld } from './world-map-assembler';
import { DEFAULT_WORLD_MAP_CONFIG } from './world-map-config';
import { placePromises } from './world-map-promises';
import {
  GAMEPLAY_ANCHOR_KINDS,
  interactionAnchorsHavePassableNeighbour,
  reserveAnchors,
} from './world-map-anchors';

function build(seed: string) {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags: ['BRANCH', 'OPEN_AREA', 'CHOKEPOINT', 'POCKET'],
    maxSections: 5,
  });
  const campAnchor = world.placedSections[0].anchor;
  const promises = placePromises(world.openSeams, campAnchor, seed, DEFAULT_WORLD_MAP_CONFIG);
  return { world, promises };
}

describe('reserveAnchors', () => {
  it('is deterministic for a given seed', () => {
    const { world, promises } = build('anch');
    expect(reserveAnchors(world, promises, 'anch')).toEqual(
      reserveAnchors(world, promises, 'anch'),
    );
  });

  it.each(['a', 'b', 'c', 'd', 'e'])('reserves at most one of each kind (%s)', (seed) => {
    const { world, promises } = build(seed);
    const anchors = reserveAnchors(world, promises, seed);

    for (const kind of GAMEPLAY_ANCHOR_KINDS) {
      expect(anchors.filter((a) => a.kind === kind).length).toBeLessThanOrEqual(1);
    }
  });

  it.each(['a', 'b', 'c', 'd', 'e'])(
    'every interaction anchor has a passable neighbour (%s)',
    (seed) => {
      const { world, promises } = build(seed);
      const anchors = reserveAnchors(world, promises, seed);

      expect(interactionAnchorsHavePassableNeighbour(world, anchors)).toBe(true);
    },
  );
});
