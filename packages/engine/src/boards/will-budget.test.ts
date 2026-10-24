import { describe, expect, it } from 'vitest';
import { buildStaticBoard } from './build-static-board';
import { measureBoard } from './measure-board';
import { runBoardPipeline } from './pipeline/run-board-pipeline';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { CAVE_MODEL } from '../content/boards/models/cave';
import { getMeta } from '../content/content-accessors';
import { EHexActionType } from '../enums/hex-action-type';
import { KNOWLEDGE_RULES } from '../knowledge/math';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

const SEEDS = 500;

function actionCost(key: Parameters<typeof getMeta>[0], action: EHexActionType): number {
  return getMeta(key).actions?.[action]?.willCost ?? 0;
}

describe('Will budget of the silesia + cave trip (REQ-BOARD-008)', () => {
  const silesia = measureBoard(
    buildStaticBoard(SILESIA_BOARD).map,
    HEXOBJECT_KEYS.CAMPING_ENTRANCE,
  );
  const toCave = silesia.stepsToObject[HEXOBJECT_KEYS.CAVE_ENTRANCE] as number;

  it('silesia puts the cave entrance within 4 steps of the camping entrance', () => {
    expect(toCave).toBeGreaterThanOrEqual(0);
    expect(toCave).toBeLessThanOrEqual(4);
  });

  it(`a round trip to the cave treasure fits the Will capacity on all ${SEEDS} seeds`, () => {
    const enterCost = actionCost(HEXOBJECT_KEYS.CAVE_ENTRANCE, EHexActionType.ENTER);
    const chestCost = actionCost(HEXOBJECT_KEYS.CHEST, EHexActionType.OPEN);
    let worstTrip = 0;

    for (let i = 0; i < SEEDS; i += 1) {
      const cave = runBoardPipeline(CAVE_MODEL, { seed: `budget-${i}` });
      const toTreasure = cave.measures?.stepsToObject[HEXOBJECT_KEYS.CHEST];
      expect(toTreasure).not.toBeNull();
      expect(toTreasure).toBeDefined();

      const trip = 2 * toCave + enterCost + 2 * (toTreasure as number) + chestCost;
      worstTrip = Math.max(worstTrip, trip);
    }

    expect(worstTrip).toBeLessThanOrEqual(KNOWLEDGE_RULES.capacity);
  });
});
