import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { catalogueOf, BOARD_QUESTS, questContentFailures, questSellValue } from './quests.content';
import { counting } from './quest-test-setup';
import { validateContent } from '../content/validate-content';

describe('board quest content', () => {
  it('includes the original board quests and the pilot, all valid and unique', () => {
    expect(BOARD_QUESTS.map((quest) => quest.id)).toEqual([
      'woodcutter',
      'stonebreaker',
      'scholar',
      'bone-hunter',
      'camp-lectern',
    ]);
    expect(questContentFailures()).toEqual([]);
  });

  it('REQ-QB-012: no repeatable reward sells for more than its limit', () => {
    expect(
      BOARD_QUESTS.filter((quest) => quest.repeat === 'repeatable').map(questSellValue),
    ).toEqual([120, 30, 20, 6]);
    const factory = counting('axe-farm', 'X', 1, {
      rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.SWORD, amount: 1 }],
      maxSellValue: 100,
    });
    expect(questContentFailures([factory])).toEqual(['axe-farm: reward sells for 200 over 100']);
    const unlimited = counting('no-limit', 'X', 1, {
      rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.AXE, amount: 1 }],
    });
    expect(questContentFailures([unlimited])).toEqual([
      'no-limit: repeatable reward without maxSellValue',
    ]);
    const once = counting('gift', 'X', 1, {
      repeat: 'once',
      rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.SWORD, amount: 1 }],
    });
    expect(questContentFailures([once])).toEqual([]);
  });

  it('reports a duplicate id and an unknown requirement', () => {
    const dup = counting('same', 'X', 1);
    const gated = counting('gated', 'X', 1, {
      requires: [{ kind: 'questDone', questId: 'ghost' }],
    });
    expect(questContentFailures([dup, dup, gated])).toEqual([
      'same: duplicate id',
      'gated: unknown requirement ghost',
    ]);
  });

  it('REQ-QB-013: every quest has a table rule, a name and a description key of its own', () => {
    const keys = BOARD_QUESTS.flatMap((quest) => [quest.nameKey, quest.descKey, quest.tableRule]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const quest of BOARD_QUESTS) {
      expect(quest.nameKey).toBe(`quest.${quest.id}.name`);
      expect(quest.descKey).toBe(`quest.${quest.id}.desc`);
      expect(quest.tableRule).toBe(`quest.${quest.id}.table`);
    }
    expect(Object.keys(catalogueOf(BOARD_QUESTS))).toHaveLength(BOARD_QUESTS.length);
  });
});

describe('quest content in validateContent', () => {
  it('passes for the shipped quests and Seeker cards', () => {
    expect(() => validateContent()).not.toThrow();
  });

  it('is judged by the same failures the validator collects', () => {
    const broken = counting('no-limit', 'X', 1, {
      rewards: [{ kind: 'item', itemKey: HEXOBJECT_KEYS.AXE, amount: 1 }],
    });
    expect(questContentFailures([...BOARD_QUESTS, broken])).toEqual([
      'no-limit: repeatable reward without maxSellValue',
    ]);
  });
});
