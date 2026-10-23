import { z } from 'zod';

export const SKILL_IDS = ['attack', 'defense'] as const;
export const skillIdSchema = z.enum(SKILL_IDS);
export type SkillId = z.infer<typeof skillIdSchema>;

export const skillDefinitionSchema = z
  .object({
    id: skillIdSchema,
    effect: z.enum(['attack', 'defense']),
    bonusPerRank: z.number().positive(),
    rankCosts: z.array(z.number().int().positive()).min(1),
  })
  .refine(
    (skill) => skill.rankCosts.every((cost, i) => i === 0 || cost >= skill.rankCosts[i - 1]),
    {
      message: 'Rank costs must not decrease',
    },
  );
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

/** Candidate balance; deliberately small so equipment stays the main source of power. */
const SHARED_RANK_COSTS = [20, 20, 25, 25, 30, 30, 35, 40, 45, 50];

export const SKILLS: Record<SkillId, SkillDefinition> = {
  attack: {
    id: 'attack',
    effect: 'attack',
    bonusPerRank: 0.05,
    rankCosts: SHARED_RANK_COSTS,
  },
  defense: {
    id: 'defense',
    effect: 'defense',
    bonusPerRank: 0.05,
    rankCosts: SHARED_RANK_COSTS,
  },
};
