import { describe, expect, it } from 'vitest';
import type { QuestProjection } from '@hexoflat/engine/quests/projection';
import { FIELD_CENTER } from '@hexoflat/engine/quests/treasure-field';
import { axialToOffset, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import en from '@/locales/en/ui.json';
import uk from '@/locales/uk/ui.json';
import { getByPath } from '@/i18n/locale-keys';
import { buildQuestField, resolveFieldClick } from './quest-field-model';
import { resultFromEvents } from './quest-result';

const START = axialToOffset(FIELD_CENTER);
const [near] = getHexNeighbors(START);

const lost: QuestProjection = {
  offerId: 'seeker-1',
  phase: 'lost',
  outcome: null,
  start: START,
  position: near,
  path: [{ hex: near, number: 1 }],
  opened: [{ hex: near, number: 1, footprint: false }],
  hintHex: null,
  chest: null,
  collect: null,
  stepCost: 1,
  backCost: 3,
};

describe('lost treasure on the quest field', () => {
  it('draws no chest or loot and offers no step or click', () => {
    const field = buildQuestField(lost);
    expect(field.chest).toBeNull();
    expect(field.ground).toHaveLength(0);
    expect(field.hexes.filter((cell) => cell.step)).toHaveLength(0);
    expect(resolveFieldClick(lost, near)).toBeNull();
    expect(resolveFieldClick(lost, START)).toBeNull();
  });

  it('turns the closing events into a lost result', () => {
    const result = resultFromEvents([
      {
        type: 'QUEST_FAILED',
        payload: {
          questId: 'seeker-1',
          reason: 'TREASURE_LOST',
          recap: {
            numbers: [1],
            answerReview: [false],
            firstDeviation: { number: 4, expected: 3 },
          },
        },
      },
      { type: 'QUEST_SUMMARY', payload: { outcome: 'lost' } },
    ]);
    expect(result?.outcome).toBe('lost');
    expect(result?.answerReview).toEqual([false]);
  });

  it('has the lost texts in both languages', () => {
    for (const locale of [en, uk]) {
      for (const key of [
        'quest.run.lost',
        'quest.run.lostHint',
        'quest.run.leaveMap',
        'quest.result.lost',
      ]) {
        expect(getByPath(locale, key)).toEqual(expect.any(String));
      }
    }
  });
});
