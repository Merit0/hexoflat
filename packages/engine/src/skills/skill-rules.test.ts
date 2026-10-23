import { describe, expect, it } from 'vitest';
import { getMaxRank, getNextRankCost, getSkillBonuses, getSkillRank } from './skill-rules';

describe('skill rules', () => {
  it('reads a missing skill as rank 0 and clamps to the top rank', () => {
    expect(getSkillRank({}, 'attack')).toBe(0);
    expect(getSkillRank({ attack: 99 }, 'attack')).toBe(getMaxRank('attack'));
    expect(getSkillRank({ attack: -3 }, 'attack')).toBe(0);
  });

  it('prices the next rank, and nothing at the top rank', () => {
    expect(getNextRankCost({}, 'attack')).toBe(20);
    expect(getNextRankCost({ attack: 2 }, 'attack')).toBe(25);
    expect(getNextRankCost({ attack: 10 }, 'attack')).toBeNull();
  });

  it('sums rank bonuses per effect with rounding', () => {
    expect(getSkillBonuses({})).toEqual({ attack: 0, defense: 0 });
    expect(getSkillBonuses({ attack: 3, defense: 7 })).toEqual({ attack: 0.15, defense: 0.35 });
    expect(getSkillBonuses({ attack: 10, defense: 10 })).toEqual({ attack: 0.5, defense: 0.5 });
  });
});
