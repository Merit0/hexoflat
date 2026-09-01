import { describe, expect, it } from 'vitest';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import { assembleWorld, type AssembledWorld } from './world-map-assembler';

function assemble(seed: string, maxSections = 6): AssembledWorld {
  return assembleWorld({ seed, sections: WORLD_SECTIONS, maxSections });
}

function serialize(world: AssembledWorld) {
  return JSON.stringify({
    map: world.map.toJSON(),
    placedSections: world.placedSections,
    openSeams: world.openSeams,
    terrainByCoord: world.terrainByCoord,
  });
}

describe('assembleWorld', () => {
  it('produces an identical layout for the same seed', () => {
    expect(serialize(assemble('alpha'))).toEqual(serialize(assemble('alpha')));
  });

  it('produces different layouts across seeds', () => {
    const layouts = new Set(
      ['a', 'b', 'c', 'd', 'e'].map((s) => JSON.stringify(assemble(s).map.toJSON())),
    );
    expect(layouts.size).toBeGreaterThanOrEqual(2);
  });

  it('never overlaps two hexes on the same coordinate', () => {
    const { map } = assemble('overlap');
    const keys = map.tiles.map((t) => coordinateKey(t.coordinates));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(
    Array.from({ length: 24 }, (_, i) => `conn-${i}`).concat('seed-4', 'seed-5', 'connected'),
  )('lays every hex connected to the rest (%s)', (seed) => {
    const { map } = assemble(seed);
    const present = new Set(map.tiles.map((t) => coordinateKey(t.coordinates)));
    const seen = new Set<string>([coordinateKey(map.tiles[0].coordinates)]);
    const queue = [map.tiles[0].coordinates];

    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of getOddQNeighbors(cur)) {
        const k = coordinateKey(n);
        if (present.has(k) && !seen.has(k)) {
          seen.add(k);
          queue.push(n);
        }
      }
    }

    expect(seen.size).toBe(present.size);
  });

  it.each(['normalise', 'norm-2', 'norm-3'])(
    'normalises coordinates near the origin (%s)',
    (seed) => {
      const { map } = assemble(seed);
      const cols = map.tiles.map((t) => t.coordinates.columnIndex);
      const rows = map.tiles.map((t) => t.coordinates.rowIndex);

      expect(Math.min(...cols)).toBeLessThanOrEqual(1);
      expect(Math.min(...cols)).toBeGreaterThanOrEqual(0);
      expect(Math.min(...rows)).toBe(0);
      expect(map.width).toBe(Math.max(...cols) + 1);
      expect(map.height).toBe(Math.max(...rows) + 1);
    },
  );

  it('starts from the camp anchor section', () => {
    const world = assemble('anchor');
    expect(world.placedSections[0].key).toBe('camp-anchor');
    expect(world.placedSections.length).toBeGreaterThan(1);
  });

  it('lays more than just the start section', () => {
    const world = assemble('growth', 5);
    expect(world.map.tiles.length).toBeGreaterThan(5);
  });

  it('terrainByCoord has an entry for every tile and nothing else', () => {
    const { map, terrainByCoord } = assemble('terrain');
    const tileKeys = new Set(map.tiles.map((t) => coordinateKey(t.coordinates)));
    expect(Object.keys(terrainByCoord).sort()).toEqual([...tileKeys].sort());
  });

  it('does not loop or throw when maxSections exceeds what the deck can place', () => {
    const world = assembleWorld({ seed: 'x', sections: WORLD_SECTIONS, maxSections: 999 });
    expect(world.placedSections.length).toBeLessThanOrEqual(WORLD_SECTIONS.length);
    expect(world.map.tiles.length).toBeGreaterThan(0);
  });
});
