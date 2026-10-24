import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from './build-static-board';
import { assembleGeneratedBoard } from './assemble-generated-board';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { CAVE_PRESET } from '../content/boards/presets/cave';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { measureBoard } from './measure-board';

const TOLERANCE = 2;
const CAVE_SEEDS = 20;

describe('measureBoard', () => {
  it('measures silesia: cave entrance is ~11 steps from the camping entrance', () => {
    const measured = measureBoard(
      buildStaticBoard(SILESIA_BOARD).map,
      HEXOBJECT_KEYS.CAMPING_ENTRANCE,
    );

    expect(measured.stepsToObject[HEXOBJECT_KEYS.CAVE_ENTRANCE]).toBeGreaterThanOrEqual(
      11 - TOLERANCE,
    );
    expect(measured.stepsToObject[HEXOBJECT_KEYS.CAVE_ENTRANCE]).toBeLessThanOrEqual(
      11 + TOLERANCE,
    );
    expect(measured.stepsToObject[HEXOBJECT_KEYS.STONE_WALL]).toBeUndefined();
    expect(measured.passableTiles).toBeLessThanOrEqual(measured.totalTiles);
    expect(measured.willCostTotal).toBeGreaterThan(0);
  });

  it(`measures ${CAVE_SEEDS} cave seeds: 80–86 passable hexes, ~4.0 neighbours, farthest 16–24 steps`, () => {
    for (let i = 0; i < CAVE_SEEDS; i += 1) {
      const measured = measureBoard(
        assembleGeneratedBoard(`cave-seed-${i}`, CAVE_PRESET).map,
        HEXOBJECT_KEYS.CAVE_EXIT,
      );

      expect(measured.passableTiles).toBeGreaterThanOrEqual(80 - TOLERANCE);
      expect(measured.passableTiles).toBeLessThanOrEqual(86 + TOLERANCE);
      expect(measured.meanPassableNeighbours).toBeGreaterThanOrEqual(4.0 - 0.3);
      expect(measured.meanPassableNeighbours).toBeLessThanOrEqual(4.0 + 0.3);
      expect(measured.farthestPassableSteps).toBeGreaterThanOrEqual(16 - TOLERANCE);
      expect(measured.farthestPassableSteps).toBeLessThanOrEqual(24 + TOLERANCE);
      expect(measured.shareLowDegree).toBeGreaterThan(0);
      expect(measured.shareLowDegree).toBeLessThan(1);
    }
  });

  it('reports null for objects with no reachable passable neighbour', () => {
    const { map } = buildStaticBoard(SILESIA_BOARD);
    const measured = measureBoard(map, HEXOBJECT_KEYS.CAVE_EXIT);

    expect(measured.farthestPassableSteps).toBe(0);
    expect(Object.values(measured.stepsToObject).every((steps) => steps === null)).toBe(true);
  });
});
