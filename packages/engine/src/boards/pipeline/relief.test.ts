import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import type { BoardRecipeInput } from '../../content/boards/recipe-schema';
import type { StaticBoardDrawing } from '../../content/boards/schemas';
import { getHexNeighbors, hexDistance, coordinateKey } from '../../utils/hex-utils';
import { BOARD_COLUMNS, BOARD_ROWS } from '../board-size';
import { runBoardPipeline, type PipelineBoard } from './run-board-pipeline';

type Piece = { kind: string; [key: string]: unknown };

const OPEN_FIELD: StaticBoardDrawing = {
  id: 'open-field',
  background: '',
  legend: {},
  rows: Array.from({ length: BOARD_ROWS }, (_, row) => {
    const cells = Array.from({ length: BOARD_COLUMNS }, () => '.');
    return (row % 2 === 1 ? ' ' : '') + cells.join(' ');
  }),
};

function fieldWith(relief: Piece[], objects: Piece[] = []): BoardRecipeInput {
  return {
    id: 'relief-probe',
    version: 1,
    kind: 'generated',
    frame: { columns: BOARD_COLUMNS, rows: BOARD_ROWS },
    background: '',
    fog: 'FOG',
    stages: {
      form: [{ kind: 'drawing', drawing: OPEN_FIELD }],
      relief,
      objects,
    },
  };
}

function tilesWith(built: PipelineBoard, terrain: string) {
  return built.map.tiles.filter((tile) => tile.terrain === terrain);
}

const SEEDS = 200;

describe('RELIEF:lake', () => {
  it('RELIEF:lake puts round ponds on open ground with a dry margin all around', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const built = runBoardPipeline(fieldWith([{ kind: 'lake', radius: 2, margin: 2 }]), {
        seed: `lake-${i}`,
      });
      const water = tilesWith(built, 'water');
      expect(water).toHaveLength(19);

      const waterKeys = new Set(water.map((tile) => coordinateKey(tile.coordinates)));
      for (const tile of water) {
        for (const neighbor of getHexNeighbors(tile.coordinates)) {
          const key = coordinateKey(neighbor);
          if (waterKeys.has(key)) continue;
          const around = built.map.tiles.find(
            (candidate) => coordinateKey(candidate.coordinates) === key,
          );
          expect(around?.terrain).toBe('ground');
        }
      }
    }
  });

  it('RELIEF:lake count places several separate lakes and varies with the seed', () => {
    const many = runBoardPipeline(fieldWith([{ kind: 'lake', count: 3, radius: 1 }]), {
      seed: 'a',
    });
    expect(tilesWith(many, 'water')).toHaveLength(21);

    const first = runBoardPipeline(fieldWith([{ kind: 'lake' }]), { seed: 'one' });
    const second = runBoardPipeline(fieldWith([{ kind: 'lake' }]), { seed: 'two' });
    expect(first.map.toJSON()).not.toEqual(second.map.toJSON());
  });

  it('RELIEF:lake stays off the board when nothing fits instead of failing', () => {
    const built = runBoardPipeline(fieldWith([{ kind: 'lake', radius: 2, margin: 20 }]), {
      seed: 'tight',
    });
    expect(tilesWith(built, 'water')).toHaveLength(0);
  });
});

describe('RELIEF:ridge', () => {
  it('RELIEF:ridge builds one connected mountain chain hugging the chosen edge', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const built = runBoardPipeline(fieldWith([{ kind: 'ridge', edge: 'N' }]), {
        seed: `ridge-${i}`,
      });
      const mountains = tilesWith(built, 'mountain');
      expect(mountains.length).toBeGreaterThan(BOARD_COLUMNS / 2);
      for (const tile of mountains) expect(tile.coordinates.rowIndex).toBeLessThanOrEqual(3);

      const keys = new Set(mountains.map((tile) => coordinateKey(tile.coordinates)));
      const seen = new Set<string>();
      const stack = [mountains[0].coordinates];
      while (stack.length) {
        const current = stack.pop()!;
        const key = coordinateKey(current);
        if (seen.has(key) || !keys.has(key)) continue;
        seen.add(key);
        stack.push(...getHexNeighbors(current));
      }
      expect(seen.size).toBe(keys.size);
    }
  });

  it('RELIEF:ridge picks an edge by seed when none is given and never covers an object', () => {
    const edges = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const built = runBoardPipeline(fieldWith([{ kind: 'ridge' }]), { seed: `edge-${i}` });
      const mountains = tilesWith(built, 'mountain');
      const sample = mountains[0].coordinates;
      edges.add(
        sample.rowIndex <= 3
          ? 'N'
          : sample.rowIndex >= BOARD_ROWS - 4
            ? 'S'
            : sample.columnIndex <= 3
              ? 'W'
              : 'E',
      );
      expect(
        built.map.tiles.some((tile) => tile.terrain === 'mountain' && tile.hexobject !== null),
      ).toBe(false);
    }
    expect(edges.size).toBeGreaterThan(1);
  });
});

describe('RELIEF:sea', () => {
  it('RELIEF:sea floods the chosen edge to its depth with a shore that wavers', () => {
    const depths = new Set<number>();
    for (let i = 0; i < SEEDS; i += 1) {
      const built = runBoardPipeline(fieldWith([{ kind: 'sea', edges: ['S'], depth: [2, 4] }]), {
        seed: `sea-${i}`,
      });
      const water = tilesWith(built, 'water');
      const southEdge = water.filter((tile) => tile.coordinates.rowIndex === BOARD_ROWS - 1);
      expect(southEdge).toHaveLength(BOARD_COLUMNS);
      for (const tile of water) {
        expect(tile.coordinates.rowIndex).toBeGreaterThanOrEqual(BOARD_ROWS - 4);
      }
      const byColumn = new Map<number, number>();
      for (const tile of water) {
        byColumn.set(
          tile.coordinates.columnIndex,
          (byColumn.get(tile.coordinates.columnIndex) ?? 0) + 1,
        );
      }
      for (const depth of byColumn.values()) depths.add(depth);
    }
    expect([...depths].sort()).toEqual([2, 3, 4]);
  });

  it('RELIEF:sea count 2 uses two different edges', () => {
    const built = runBoardPipeline(fieldWith([{ kind: 'sea', count: 2 }]), { seed: 'two' });
    const touched = new Set<string>();
    for (const tile of tilesWith(built, 'water')) {
      const { columnIndex, rowIndex } = tile.coordinates;
      if (rowIndex === 0) touched.add('N');
      if (rowIndex === BOARD_ROWS - 1) touched.add('S');
      if (columnIndex === 0) touched.add('W');
      if (columnIndex === BOARD_COLUMNS - 1) touched.add('E');
    }
    expect(touched.size).toBeGreaterThanOrEqual(2);
  });
});

describe('WHERE:next', () => {
  it('WHERE:next puts objects only on tiles touching the named terrain', () => {
    const rules = [
      {
        kind: 'rules',
        rules: [
          {
            id: 'shore-rocks',
            pick: HEXOBJECT_KEYS.ROCK,
            count: 5,
            where: { next: 'water' },
          },
        ],
      },
    ];
    for (let i = 0; i < 50; i += 1) {
      const built = runBoardPipeline(
        fieldWith([{ kind: 'sea', edges: ['S'], depth: [2, 3] }], rules),
        { seed: `next-${i}` },
      );
      const rocks = built.map.tiles.filter(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.ROCK,
      );
      expect(rocks).toHaveLength(5);
      for (const rock of rocks) {
        const touchesWater = getHexNeighbors(rock.coordinates).some((neighbor) =>
          built.map.tiles.some(
            (tile) => tile.terrain === 'water' && hexDistance(tile.coordinates, neighbor) === 0,
          ),
        );
        expect(touchesWater).toBe(true);
      }
    }
  });

  it('WHERE:next reports a shortfall when the terrain is absent', () => {
    const built = runBoardPipeline(
      fieldWith(
        [],
        [
          {
            kind: 'rules',
            rules: [{ id: 'dry', pick: HEXOBJECT_KEYS.ROCK, count: 2, where: { next: 'water' } }],
          },
        ],
      ),
      { seed: 'dry' },
    );
    expect(built.trace.shortfalls[0]?.ruleId).toBe('dry');
    expect(built.trace.shortfalls[0]?.placed).toBe(0);
  });
});
