import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { BoardRecipeInput } from '../../content/boards/recipe-schema';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { getHexNeighbors, coordinateKey } from '../../utils/hex-utils';
import { runBoardPipeline } from './run-board-pipeline';

const SEEDS = 500;

function caveShape(link: 'chain' | 'branch' | 'loop', count: number | [number, number] = [4, 5]) {
  return {
    id: 'blobs-probe',
    version: 1,
    kind: 'generated',
    frame: { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
    background: '',
    fog: 'FOG',
    entryObject: HEXOBJECT_KEYS.CAVE_EXIT,
    stages: {
      form: [{ kind: 'blobs', count, radius: 2, link }],
      bounds: [{ kind: 'wall', enclose: true }],
      gates: [{ kind: 'entry' }],
      checks: [{ kind: 'shape', minRegions: 4, minRegionHexes: 19 }, { kind: 'reachable' }],
    },
  } satisfies BoardRecipeInput;
}

describe('FORM:blobs', () => {
  it.each(['chain', 'branch', 'loop'] as const)(
    'FORM:blobs %s builds 4+ connected regions of 19+ hexes with non-rectangular outline (REQ-BOARD-002, REQ-BOARD-005) over %i seeds'.replace(
      '%i',
      String(SEEDS),
    ),
    (link) => {
      for (let i = 0; i < SEEDS; i += 1) {
        const built = runBoardPipeline(caveShape(link), { seed: `blobs-${link}-${i}` });
        const tiles = built.map.tiles;
        const wall = HEXOBJECT_KEYS.STONE_WALL;
        const floor = tiles.filter((tile) => tile.hexobject?.hexobjectKey !== wall);
        expect(floor.length).toBeGreaterThanOrEqual(4 * 19);
        expect(tiles.length).toBeLessThan(BOARD_COLUMNS * BOARD_ROWS);
        for (const tile of tiles) {
          const onEdge = tile.coordinates.columnIndex === 0 || tile.coordinates.rowIndex === 0;
          if (onEdge) expect(tile.hexobject?.hexobjectKey).toBe(wall);
        }
      }
    },
  );

  it('FORM:blobs is deterministic for one seed and differs between seeds', () => {
    const first = runBoardPipeline(caveShape('branch'), { seed: 'same' }).map.toJSON();
    const again = runBoardPipeline(caveShape('branch'), { seed: 'same' }).map.toJSON();
    const other = runBoardPipeline(caveShape('branch'), { seed: 'different' }).map.toJSON();
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('FORM:blobs link modes give chain / tree / tree-plus-loop graphs with one entry region', () => {
    for (let i = 0; i < 100; i += 1) {
      const seed = `modes-${i}`;
      const chain = runBoardPipeline(caveShape('chain', 4), { seed });
      const branch = runBoardPipeline(caveShape('branch', 4), { seed });
      const loop = runBoardPipeline(caveShape('loop', 4), { seed });

      expect(chain.links).toHaveLength(3);
      expect(branch.links).toHaveLength(3);
      expect(loop.links).toHaveLength(4);

      for (const region of chain.regions) {
        const degree = chain.links.filter(
          (link) => link.from === region.id || link.to === region.id,
        ).length;
        expect(degree).toBeLessThanOrEqual(2);
      }
      for (const built of [chain, branch, loop]) {
        expect(built.regions.filter((region) => region.role === 'entry')).toHaveLength(1);
        expect(built.regions.some((region) => region.role === 'deep')).toBe(true);
      }
    }
  });

  it('GATES:entry puts the entry object on a tile with floor on every side', () => {
    for (let i = 0; i < 100; i += 1) {
      const built = runBoardPipeline(caveShape('branch'), { seed: `entry-${i}` });
      const byKey = new Map(built.map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
      const entry = built.map.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CAVE_EXIT,
      );
      expect(entry).toBeDefined();
      for (const neighbor of getHexNeighbors(entry!.coordinates)) {
        expect(byKey.get(coordinateKey(neighbor))?.hexobject?.hexobjectKey).not.toBe(
          HEXOBJECT_KEYS.STONE_WALL,
        );
      }
    }
  });

  it('FORM:blobs rejects a radius that cannot fit', () => {
    const recipe = caveShape('branch');
    recipe.stages.form = [{ kind: 'blobs', count: 4, radius: 9, link: 'branch' }] as never;
    expect(() => runBoardPipeline(recipe, { seed: 'x' })).toThrow();
  });
});
