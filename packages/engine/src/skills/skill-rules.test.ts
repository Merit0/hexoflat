import { describe, expect, it } from 'vitest';
import { SKILL_IDS, SKILLS } from './skill-content';
import {
  getMaxRank,
  getNextRankCost,
  getPortalAbility,
  getSkillBonuses,
  getSkillRank,
  getSkillStatus,
  requirementsMet,
} from './skill-rules';

const open = { will: 50, locked: false };

describe('skill rules', () => {
  it('reads a missing skill as rank 0 and clamps to the top rank', () => {
    expect(getSkillRank({}, 'b_strike')).toBe(0);
    expect(getSkillRank({ b_strike: 99 }, 'b_strike')).toBe(getMaxRank('b_strike'));
    expect(getSkillRank({ b_strike: -3 }, 'b_strike')).toBe(0);
  });

  it('starts the bionic crest at rank 1 regardless of stored value', () => {
    expect(getSkillRank({}, 'b_crest')).toBe(1);
    expect(getSkillRank({ b_crest: 0 }, 'b_crest')).toBe(1);
    expect(getSkillRank({}, 'd_crest')).toBe(0);
  });

  it('prices the next rank, and nothing at the top rank', () => {
    expect(getNextRankCost({}, 'b_strike')).toBe(6);
    expect(getNextRankCost({ b_strike: 2 }, 'b_strike')).toBe(8);
    expect(getNextRankCost({ b_strike: 10 }, 'b_strike')).toBeNull();
    expect(getNextRankCost({}, 'b_crest')).toBeNull();
  });

  it('requires every parent at rank 1 or more', () => {
    expect(requirementsMet({}, 'b_strike')).toBe(true);
    expect(requirementsMet({}, 'a_teleport')).toBe(false);
    expect(requirementsMet({ a_crest: 1 }, 'a_teleport')).toBe(true);
    expect(requirementsMet({ b_dash: 1 }, 'b_cap')).toBe(false);
    expect(requirementsMet({ b_dash: 1, b_aim: 1 }, 'b_cap')).toBe(true);
  });

  it('reports the status in priority order', () => {
    expect(getSkillStatus({}, 'b_crest', open)).toBe('max');
    expect(getSkillStatus({ b_strike: 10 }, 'b_strike', open)).toBe('max');
    expect(getSkillStatus({ b_strike: 1 }, 'b_heavy', open)).toBe('soon');
    expect(getSkillStatus({}, 'a_teleport', open)).toBe('requires');
    expect(getSkillStatus({}, 'b_strike', { will: 50, locked: true })).toBe('locked');
    expect(getSkillStatus({}, 'b_strike', { will: 0, locked: false })).toBe('need-will');
    expect(getSkillStatus({}, 'b_strike', { will: 1, locked: false })).toBe('ready');
    expect(getSkillStatus({}, 'a_teleport', { will: 50, locked: true })).toBe('requires');
  });

  it('sums stat bonuses with rounding', () => {
    expect(getSkillBonuses({})).toEqual({ attack: 0, defense: 0 });
    expect(getSkillBonuses({ b_strike: 3, b_guard: 7 })).toEqual({ attack: 0.15, defense: 0.35 });
    expect(getSkillBonuses({ b_strike: 10, b_guard: 10 })).toEqual({ attack: 0.5, defense: 0.5 });
    expect(getSkillBonuses({ a_teleport: 3, d_crest: 1 })).toEqual({ attack: 0, defense: 0 });
  });

  it('prices the portal from 10 Will at rank 1 down to 1 Will at rank 10', () => {
    expect(getPortalAbility({})).toEqual({ unlocked: false });
    expect(getPortalAbility({ a_teleport: 1 })).toEqual({ unlocked: true, willCost: 10 });
    expect(getPortalAbility({ a_teleport: 2 })).toEqual({ unlocked: true, willCost: 9 });
    expect(getPortalAbility({ a_teleport: 6 })).toEqual({ unlocked: true, willCost: 5 });
    expect(getPortalAbility({ a_teleport: 10 })).toEqual({ unlocked: true, willCost: 1 });
  });

  it('finds the portal skill by its effect, not its id', () => {
    const portals = SKILL_IDS.filter((id) => SKILLS[id].effect.kind === 'portal');
    expect(portals).toEqual(['a_teleport']);
  });
});
