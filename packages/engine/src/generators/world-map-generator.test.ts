import { describe, expect, it } from 'vitest';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { WORLD_ARCHETYPE_KEYS } from '../content/world-section-schema';
import { DEFAULT_WORLD_MAP_CONFIG } from './world-map-config';
import { generateWorldMap } from './world-map-generator';

function gen(seed: string) {
  return generateWorldMap({ seed, archetype: 'FORKED_FRONTIER' });
}

describe('generateWorldMap', () => {
  it('is deterministic for a given seed', () => {
    const a = gen('alpha');
    const b = gen('alpha');
    expect(JSON.stringify(a.map.toJSON())).toEqual(JSON.stringify(b.map.toJSON()));
    expect(a.campAnchor).toEqual(b.campAnchor);
    expect(a.heroSpawn).toEqual(b.heroSpawn);
    expect(a.validation).toEqual(b.validation);
  });

  it('puts the camp entrance on the camp anchor', () => {
    const world = gen('anchor');
    const tile = world.map.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey(world.campAnchor),
    );
    expect(tile?.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.CAMPING_ENTRANCE);
    expect(world.map.config?.[0]?.entry?.type).toBe('DEFAULT');
  });

  it('spawns the hero on an existing passable neighbour of the camp anchor', () => {
    const world = gen('spawn');
    const present = new Set(world.map.tiles.map((t) => coordinateKey(t.coordinates)));
    const neighbours = getOddQNeighbors(world.campAnchor).map(coordinateKey);

    expect(present.has(coordinateKey(world.heroSpawn))).toBe(true);
    expect(neighbours).toContain(coordinateKey(world.heroSpawn));

    const spawnTile = world.map.tiles.find(
      (t) => coordinateKey(t.coordinates) === coordinateKey(world.heroSpawn),
    );
    expect(spawnTile?.hexobject?.collision).not.toBe(EHexCollision.SOLID);
  });

  it('puts a solid barrier on every STONE_RIDGE tile', () => {
    const world = gen('ridge');
    const ridgeKeys = Object.entries(world.terrainByCoord)
      .filter(([, terrain]) => terrain === 'STONE_RIDGE')
      .map(([key]) => key);

    for (const tile of world.map.tiles) {
      if (!ridgeKeys.includes(coordinateKey(tile.coordinates))) continue;
      expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.WOOD_AND_LEAVES);
      expect(tile.hexobject?.collision).toBe(EHexCollision.SOLID);
    }
  });

  it('never loops or throws when the config cannot be satisfied', () => {
    const impossible = {
      ...DEFAULT_WORLD_MAP_CONFIG,
      maxSeedAttempts: 3,
      symmetryRejectThreshold: 999,
    };
    const world = generateWorldMap({ seed: 'x', archetype: 'FORKED_FRONTIER', config: impossible });

    expect(world.validation.accepted).toBe(false);
    expect(world.validation.rejectionReasons.length).toBeGreaterThan(0);
    expect(world.map.tiles.length).toBeGreaterThan(0);
  });

  it('produces an accepted map for most seeds', () => {
    const accepted = ['s1', 's2', 's3', 's4', 's5'].filter((s) => gen(s).validation.accepted);
    expect(accepted.length).toBeGreaterThanOrEqual(3);
  });

  it('carries a stable versionId', () => {
    expect(gen('v').versionId).toBe('world-map-mvp-v0.1:v:FORKED_FRONTIER');
  });

  it.each(WORLD_ARCHETYPE_KEYS)('archetype "%s" is accepted for most seeds', (archetype) => {
    const accepted = ['a1', 'a2', 'a3', 'a4', 'a5'].filter(
      (s) => generateWorldMap({ seed: s, archetype }).validation.accepted,
    );
    expect(accepted.length).toBeGreaterThanOrEqual(3);
  });

  it('picks an archetype deterministically by weight and covers more than one', () => {
    const picks = Array.from(
      { length: 16 },
      (_, i) => generateWorldMap({ seed: `w${i}` }).archetype,
    );
    const picksAgain = Array.from(
      { length: 16 },
      (_, i) => generateWorldMap({ seed: `w${i}` }).archetype,
    );

    expect(picks).toEqual(picksAgain);
    expect(new Set(picks).size).toBeGreaterThan(1);
  });

  it('reports how many attempts it took', () => {
    const accepted = gen('desc');
    expect(accepted.attempts).toBeGreaterThanOrEqual(1);
    expect(accepted.attempts).toBeLessThanOrEqual(DEFAULT_WORLD_MAP_CONFIG.maxSeedAttempts + 1);

    const impossible = {
      ...DEFAULT_WORLD_MAP_CONFIG,
      maxSeedAttempts: 2,
      symmetryRejectThreshold: 999,
    };
    const fallback = generateWorldMap({
      seed: 'x',
      archetype: 'FORKED_FRONTIER',
      config: impossible,
    });
    expect(fallback.validation.accepted).toBe(false);
    expect(fallback.attempts).toBe(impossible.maxSeedAttempts + 1);
  });

  it('carries promises and gameplay anchors on the result', () => {
    const world = gen('desc');
    expect(world.promises.length).toBeGreaterThan(0);
    expect(world.promises.some((p) => p.strength !== 'SUBTLE')).toBe(true);
    expect(world.anchors.length).toBeGreaterThan(0);
    expect(world.versionId).toContain(world.archetype);
  });
});
