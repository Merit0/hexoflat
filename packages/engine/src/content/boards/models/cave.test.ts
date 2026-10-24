import { describe, expect, it } from 'vitest';
import { RecipeSchema } from '../recipe-schema';
import { runBoardPipeline } from '../../../boards/pipeline/run-board-pipeline';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { CAVE_MODEL } from './cave';

const SEEDS = 500;

describe('CAVE_MODEL', () => {
  it('is a valid recipe', () => {
    expect(() => RecipeSchema.parse(CAVE_MODEL)).not.toThrow();
  });

  it(`builds on ${SEEDS} seeds with every rule done or explained (REQ-BOARD-004, REQ-BOARD-006)`, () => {
    for (let i = 0; i < SEEDS; i += 1) {
      const built = runBoardPipeline(CAVE_MODEL, { seed: `cave-model-${i}` });
      const keys = built.map.tiles.map((tile) => tile.hexobject?.hexobjectKey);

      expect(keys).toContain(HEXOBJECT_KEYS.CAVE_EXIT);
      expect(keys).toContain(HEXOBJECT_KEYS.SKELETOR);
      for (const outcome of built.trace.ruleOutcomes) {
        if (outcome.outcome === 'short') {
          expect(built.trace.shortfalls.some((item) => item.ruleId === outcome.ruleId)).toBe(true);
        }
      }
    }
  });

  it('stays close to the V0 measurements of the old cave', () => {
    for (let i = 0; i < 100; i += 1) {
      const measures = runBoardPipeline(CAVE_MODEL, { seed: `cave-measure-${i}` }).measures;
      expect(measures?.passableTiles).toBeGreaterThanOrEqual(60);
      expect(measures?.passableTiles).toBeLessThanOrEqual(115);
      expect(measures?.farthestPassableSteps).toBeLessThanOrEqual(32);
    }
  });

  it('has a fallback seed that builds', () => {
    const fallback = runBoardPipeline(
      { ...CAVE_MODEL, fallbackSeed: CAVE_MODEL.fallbackSeed },
      { seed: CAVE_MODEL.fallbackSeed },
    );
    expect(fallback.map.tiles.length).toBeGreaterThan(0);
  });
});
