import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_RULES } from '../knowledge/math';
import { SKILL_IDS, SKILLS, skillDefinitionSchema } from './skill-content';

describe('skill content', () => {
  it.each(SKILL_IDS)('"%s" passes the schema and is keyed by its own id', (id) => {
    expect(skillDefinitionSchema.safeParse(SKILLS[id]).success).toBe(true);
    expect(SKILLS[id].id).toBe(id);
  });

  it.each(SKILL_IDS)('"%s" has ten ranks, each affordable within Will capacity', (id) => {
    const { rankCosts } = SKILLS[id];
    expect(rankCosts).toHaveLength(10);
    expect(Math.max(...rankCosts)).toBeLessThanOrEqual(KNOWLEDGE_RULES.capacity);
  });

  it('rejects rank costs that get cheaper', () => {
    const bad = { ...SKILLS.attack, rankCosts: [30, 20] };
    expect(skillDefinitionSchema.safeParse(bad).success).toBe(false);
  });

  it('keeps the maximum bonus small next to equipment', () => {
    for (const id of SKILL_IDS) {
      const { bonusPerRank, rankCosts } = SKILLS[id];
      expect(bonusPerRank * rankCosts.length).toBeLessThanOrEqual(0.5);
    }
  });
});
