import { describe, expect, it } from 'vitest';
import { coordinateKey } from '../utils/hex-utils';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import type { FrontierPromise, TWorldSectionTag } from '../content/world-section-schema';
import { assembleWorld, type AssembledWorld } from './world-map-assembler';
import { DEFAULT_WORLD_MAP_CONFIG, type WorldMapMvpConfig } from './world-map-config';
import { placePromises } from './world-map-promises';
import { validateWorld } from './world-map-validator';

const RECIPE: TWorldSectionTag[] = ['OPEN_FIELD', 'RIDGE_FIELD', 'FRONTIER_FIELD'];

interface Built {
  world: AssembledWorld;
  campAnchor: { columnIndex: number; rowIndex: number };
  promises: FrontierPromise[];
}

function build(seed: string): Built {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags: RECIPE,
    maxSections: 24,
    targetHexes: DEFAULT_WORLD_MAP_CONFIG.growTargetHexes,
    maxHexes: DEFAULT_WORLD_MAP_CONFIG.knownHexMax,
    targetLoops: DEFAULT_WORLD_MAP_CONFIG.targetLoops,
    minAreas: 4,
  });
  const campAnchor = world.placedSections[0].anchor;
  return {
    world,
    campAnchor,
    promises: placePromises(world.openSeams, campAnchor, seed, DEFAULT_WORLD_MAP_CONFIG),
  };
}

function validate(b: Built, config: WorldMapMvpConfig = DEFAULT_WORLD_MAP_CONFIG) {
  return validateWorld({
    world: b.world,
    campAnchor: b.campAnchor,
    config,
    requiredTags: RECIPE,
    promises: b.promises,
  });
}

function acceptedBuild(): Built {
  for (let i = 0; i < 40; i += 1) {
    const b = build(`accepted-${i}`);
    if (validate(b).accepted) return b;
  }
  throw new Error('no accepted world found for the validator test');
}

describe('validateWorld', () => {
  it('accepts a well-formed generated world with no reasons', () => {
    const result = validate(acceptedBuild());
    expect(result.rejectionReasons).toEqual([]);
    expect(result.accepted).toBe(true);
  });

  it('flags asymmetry when the threshold is impossible', () => {
    const result = validate(acceptedBuild(), {
      ...DEFAULT_WORLD_MAP_CONFIG,
      symmetryRejectThreshold: 999,
    });

    expect(result.accepted).toBe(false);
    expect(result.rejectionReasons.some((r) => r.startsWith('asymmetry'))).toBe(true);
  });

  it('flags tag coverage when a required area is missing', () => {
    const b = acceptedBuild();
    b.world.placedSections = b.world.placedSections.filter(
      (p) => !p.tags.includes('FRONTIER_FIELD'),
    );

    expect(validate(b).rejectionReasons.some((r) => r.startsWith('tag-coverage'))).toBe(true);
  });

  it('flags the promise invariant when every promise is SUBTLE', () => {
    const b = acceptedBuild();
    b.promises = b.promises.map((p) => ({ ...p, strength: 'SUBTLE' as const }));

    expect(validate(b).rejectionReasons.some((r) => r.startsWith('promise'))).toBe(true);
  });

  it('flags connectivity when a passable tile is walled off', () => {
    const b = acceptedBuild();
    for (const tile of b.world.map.tiles) {
      const k = coordinateKey(tile.coordinates);
      if (k === coordinateKey(b.campAnchor)) continue;
      b.world.terrainByCoord[k] = 'STONE_RIDGE';
    }
    const last = b.world.map.tiles[b.world.map.tiles.length - 1];
    b.world.terrainByCoord[coordinateKey(last.coordinates)] = 'OPEN_GROUND';

    expect(validate(b).rejectionReasons.some((r) => r.startsWith('connectivity'))).toBe(true);
  });

  it('flags the boardness invariants on a thin, trail-like world', () => {
    const b = acceptedBuild();
    const keep = new Set(b.world.map.tiles.slice(0, 6).map((t) => coordinateKey(t.coordinates)));
    for (const tile of b.world.map.tiles) {
      const k = coordinateKey(tile.coordinates);
      if (k === coordinateKey(b.campAnchor) || keep.has(k)) continue;
      b.world.terrainByCoord[k] = 'STONE_RIDGE';
    }

    const reasons = validate(b).rejectionReasons.map((r) => r.split(':')[0]);
    expect(reasons.some((r) => r === 'thin-mean' || r === 'thin-share')).toBe(true);
  });

  it('flags no-lock-in when every camp-anchor neighbour is blocked', () => {
    const b = acceptedBuild();
    for (const tile of b.world.map.tiles) {
      if (coordinateKey(tile.coordinates) === coordinateKey(b.campAnchor)) continue;
      b.world.terrainByCoord[coordinateKey(tile.coordinates)] = 'STONE_RIDGE';
    }

    expect(validate(b).rejectionReasons.some((r) => r.startsWith('no-lock-in'))).toBe(true);
  });
});
