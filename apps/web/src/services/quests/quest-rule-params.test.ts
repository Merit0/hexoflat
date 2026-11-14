import { describe, expect, it } from 'vitest';
import { ALL_QUESTS } from '@hexoflat/engine/quests/all-quests';
import { questRuleParams } from './quest-rule-params';

describe('quest rule params', () => {
  it('reads the Will price of cutting and mining from content', () => {
    expect(questRuleParams(ALL_QUESTS.woodcutter).will).toBe(1);
    expect(questRuleParams(ALL_QUESTS.stonebreaker).will).toBe(2);
  });

  it('reads the entry price of a quest that costs Will', () => {
    expect(questRuleParams(ALL_QUESTS['bone-hunter']).entry).toBe(5);
    expect(questRuleParams(ALL_QUESTS.woodcutter).entry).toBe(0);
  });

  it('reads step, back and length of a Seeker card from its params', () => {
    expect(questRuleParams(ALL_QUESTS['seeker-1'])).toEqual({
      will: 0,
      entry: 20,
      steps: 10,
      step: 1,
      back: 3,
    });
    expect(questRuleParams(ALL_QUESTS['seeker-3']).step).toBe(2);
  });
});
