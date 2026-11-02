import { describe, expect, it } from 'vitest';
import { runBoardPipeline } from '../../../boards/pipeline/run-board-pipeline';
import { HEXOBJECT_KEYS } from '../../../registry/hexobjects-registry';
import { BOARD_MODELS } from './index';

const SEEDS = 200;

describe('generated dungeon boards', () => {
  for (const [id, model] of Object.entries(BOARD_MODELS)) {
    it(`never place a fireplace on ${id} (${SEEDS} seeds)`, () => {
      for (let i = 0; i < SEEDS; i += 1) {
        const built = runBoardPipeline(model, { seed: `${id}-fireplace-${i}` });
        const keys = built.map.tiles.map((tile) => tile.hexobject?.hexobjectKey);
        expect(keys).not.toContain(HEXOBJECT_KEYS.FIREPLACE);
      }
    });
  }
});
