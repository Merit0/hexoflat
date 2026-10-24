import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from './build-static-board';
import { runBoardPipeline } from './pipeline/run-board-pipeline';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { CAVE_MODEL } from '../content/boards/models/cave';
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

  it(`measures ${CAVE_SEEDS} cave seeds: 60–115 passable hexes, 3.2–4.4 neighbours, farthest ≤ 32 steps`, () => {
    for (let i = 0; i < CAVE_SEEDS; i += 1) {
      const measured = measureBoard(
        runBoardPipeline(CAVE_MODEL, { seed: `cave-seed-${i}` }).map,
        HEXOBJECT_KEYS.CAVE_EXIT,
      );

      expect(measured.passableTiles).toBeGreaterThanOrEqual(60);
      expect(measured.passableTiles).toBeLessThanOrEqual(115);
      expect(measured.meanPassableNeighbours).toBeGreaterThanOrEqual(3.2);
      expect(measured.meanPassableNeighbours).toBeLessThanOrEqual(4.4);
      expect(measured.farthestPassableSteps).toBeLessThanOrEqual(32);
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
