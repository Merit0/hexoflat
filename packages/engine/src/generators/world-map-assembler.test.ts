import { describe, expect, it } from 'vitest';
import { coordinateKey, getOddQNeighbors } from '../utils/hex-utils';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import type { TWorldSectionTag } from '../content/world-section-schema';
import { assembleWorld, type AssembledWorld } from './world-map-assembler';

function assemble(seed: string, over: Partial<Parameters<typeof assembleWorld>[0]> = {}) {
  return assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    maxSections: 24,
    targetHexes: 45,
    maxHexes: 80,
    targetLoops: 2,
    ...over,
  });
}

function serialize(world: AssembledWorld) {
  return JSON.stringify({
    map: world.map.toJSON(),
    placedSections: world.placedSections,
    openSeams: world.openSeams,
    terrainByCoord: world.terrainByCoord,
    sectionGraph: world.sectionGraph,
    loopsClosed: world.loopsClosed,
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

  it('starts from the camp anchor area', () => {
    const world = assemble('anchor');
    expect(world.placedSections[0].key).toBe('camp-field');
    expect(world.placedSections[0].class).toBe('AREA');
    expect(world.placedSections.length).toBeGreaterThan(1);
  });

  it('reaches a board-sized hex count', () => {
    const world = assemble('growth');
    expect(world.map.tiles.length).toBeGreaterThanOrEqual(60);
    expect(world.map.tiles.length).toBeLessThanOrEqual(130);
  });

  it('never joins AREA to AREA or LINK to LINK directly', () => {
    for (const seed of ['g1', 'g2', 'g3', 'g4', 'g5']) {
      const world = assemble(seed);
      for (const [a, b] of world.sectionGraph.edges) {
        const nodeA = world.sectionGraph.nodes.find((n) => n.id === a);
        const nodeB = world.sectionGraph.nodes.find((n) => n.id === b);
        if (nodeA && nodeB) {
          expect(
            nodeA.class !== nodeB.class,
            `${seed}: ${nodeA.key}(${nodeA.class}) joined to ${nodeB.key}(${nodeB.class})`,
          ).toBe(true);
        }
      }
    }
  });

  it('closes at least two loops on most seeds', () => {
    const closed = ['l1', 'l2', 'l3', 'l4', 'l5'].map((s) => assemble(s).loopsClosed);
    expect(closed.filter((c) => c >= 2).length).toBeGreaterThanOrEqual(3);
  });

  it('terrainByCoord has an entry for every tile and nothing else', () => {
    const { map, terrainByCoord } = assemble('terrain');
    const tileKeys = new Set(map.tiles.map((t) => coordinateKey(t.coordinates)));
    expect(Object.keys(terrainByCoord).sort()).toEqual([...tileKeys].sort());
  });

  it('does not loop or throw when maxSections is very large', () => {
    const world = assemble('x', { maxSections: 999 });
    expect(world.map.tiles.length).toBeGreaterThan(0);
    expect(world.map.tiles.length).toBeLessThanOrEqual(150);
  });

  it('places areas carrying the recipe tags when requiredTags is given', () => {
    const requiredTags: TWorldSectionTag[] = ['OPEN_FIELD', 'RIDGE_FIELD', 'FRONTIER_FIELD'];
    const world = assemble('recipe', { requiredTags: [...requiredTags] });

    const placedTags = new Set(world.placedSections.flatMap((p) => p.tags));
    expect(world.placedSections[0].key).toBe('camp-field');
    for (const tag of requiredTags) {
      expect(placedTags.has(tag), `recipe tag "${tag}" not placed`).toBe(true);
    }
  });

  it('is deterministic with a recipe', () => {
    const over = {
      requiredTags: ['OPEN_FIELD', 'RIDGE_FIELD', 'FRONTIER_FIELD'] as TWorldSectionTag[],
    };
    expect(serialize(assemble('recipe-det', over))).toEqual(
      serialize(assemble('recipe-det', over)),
    );
  });
});
