import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_RULES } from '../knowledge/math';
import {
  SKILL_BRANCHES,
  SKILL_IDS,
  SKILLS,
  skillDefinitionSchema,
  type SkillId,
} from './skill-content';

const byBranchSlot = (branch: string, slot: string) =>
  SKILL_IDS.filter((id) => SKILLS[id].branch === branch && SKILLS[id].slot === slot);

describe('skill content', () => {
  it.each(SKILL_IDS)('"%s" passes the schema and is keyed by its own id', (id) => {
    expect(skillDefinitionSchema.safeParse(SKILLS[id]).success).toBe(true);
    expect(SKILLS[id].id).toBe(id);
    expect(SKILLS[id].rankCosts).toHaveLength(SKILLS[id].maxRank);
  });

  it('has 24 nodes and exactly 6 implemented ones', () => {
    expect(SKILL_IDS).toHaveLength(24);
    expect(SKILL_IDS.filter((id) => SKILLS[id].implemented).sort()).toEqual(
      ['a_crest', 'a_teleport', 'b_crest', 'b_guard', 'b_strike', 'd_crest'].sort(),
    );
  });

  it('keeps every rank affordable within Will capacity', () => {
    for (const id of SKILL_IDS) {
      expect(Math.max(...SKILLS[id].rankCosts)).toBeLessThanOrEqual(KNOWLEDGE_RULES.capacity);
    }
  });

  it('rejects rank costs that get cheaper or mismatch maxRank', () => {
    expect(
      skillDefinitionSchema.safeParse({ ...SKILLS.b_strike, rankCosts: [30, 20], maxRank: 2 })
        .success,
    ).toBe(false);
    expect(skillDefinitionSchema.safeParse({ ...SKILLS.b_strike, maxRank: 3 }).success).toBe(false);
  });

  it('rejects a portal effect with the wrong number of costs', () => {
    const bad = { ...SKILLS.a_teleport, effect: { kind: 'portal', willCostByRank: [5] } };
    expect(skillDefinitionSchema.safeParse(bad).success).toBe(false);
  });

  it('keeps stat bonuses small next to equipment', () => {
    for (const id of SKILL_IDS) {
      const { effect, maxRank } = SKILLS[id];
      if (effect.kind === 'stat') expect(effect.perRank * maxRank).toBeLessThanOrEqual(0.5);
    }
  });

  it('gives each branch exactly one node per slot', () => {
    for (const branch of SKILL_BRANCHES) {
      for (const slot of ['crest', '1L', '1R', '2L', '2R', '3L', '3R', 'cap']) {
        expect(byBranchSlot(branch, slot)).toHaveLength(1);
      }
    }
  });

  it('wires requirements as crest -> columns -> cap in the same branch', () => {
    for (const branch of SKILL_BRANCHES) {
      const at = (slot: string): SkillId => byBranchSlot(branch, slot)[0];
      expect(SKILLS[at('crest')].requires).toEqual([]);
      for (const side of ['L', 'R']) {
        expect(SKILLS[at(`1${side}`)].requires).toEqual([at('crest')]);
        expect(SKILLS[at(`2${side}`)].requires).toEqual([at(`1${side}`)]);
        expect(SKILLS[at(`3${side}`)].requires).toEqual([at(`2${side}`)]);
      }
      expect([...SKILLS[at('cap')].requires].sort()).toEqual([at('3L'), at('3R')].sort());
    }
  });

  it('only the bionic crest starts unlocked', () => {
    expect(SKILL_IDS.filter((id) => SKILLS[id].startRank === 1)).toEqual(['b_crest']);
  });
});
