import { z } from 'zod';

export const SKILL_BRANCHES = ['demonic', 'bionic', 'angelic'] as const;
export const SKILL_SLOTS = ['crest', '1L', '1R', '2L', '2R', '3L', '3R', 'cap'] as const;
export const SKILL_IDS = [
  'b_crest',
  'b_strike',
  'b_guard',
  'b_heavy',
  'b_endure',
  'b_dash',
  'b_aim',
  'b_cap',
  'd_crest',
  'd_curse',
  'd_blood',
  'd_fear',
  'd_shadow',
  'd_devour',
  'd_sight',
  'd_cap',
  'a_crest',
  'a_teleport',
  'a_heal',
  'a_gate2',
  'a_ward',
  'a_wings',
  'a_light',
  'a_cap',
] as const;

export const skillIdSchema = z.enum(SKILL_IDS);
export type SkillId = z.infer<typeof skillIdSchema>;
export type SkillBranch = (typeof SKILL_BRANCHES)[number];
export type SkillSlot = (typeof SKILL_SLOTS)[number];

const skillEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('stat'),
    stat: z.enum(['attack', 'defense']),
    perRank: z.number().positive(),
  }),
  z.object({
    kind: z.literal('portal'),
    willCostByRank: z.array(z.number().int().min(0)).min(1),
  }),
]);
export type SkillEffect = z.infer<typeof skillEffectSchema>;

export const skillDefinitionSchema = z
  .object({
    id: skillIdSchema,
    branch: z.enum(SKILL_BRANCHES),
    slot: z.enum(SKILL_SLOTS),
    maxRank: z.number().int().positive(),
    rankCosts: z.array(z.number().int().min(0)),
    requires: z.array(skillIdSchema),
    startRank: z.union([z.literal(0), z.literal(1)]).default(0),
    implemented: z.boolean(),
    effect: skillEffectSchema,
  })
  .refine((skill) => skill.rankCosts.length === skill.maxRank, {
    message: 'rankCosts must have one entry per rank',
  })
  .refine(
    (skill) => skill.rankCosts.every((cost, i) => i === 0 || cost >= skill.rankCosts[i - 1]),
    { message: 'Rank costs must not decrease' },
  )
  .refine(
    (skill) =>
      skill.effect.kind !== 'portal' || skill.effect.willCostByRank.length === skill.maxRank,
    { message: 'willCostByRank must have one entry per rank' },
  );
export type SkillDefinition = z.infer<typeof skillDefinitionSchema>;

const BRANCH_CAP_COSTS = [30];

type SkillSeed = Omit<SkillDefinition, 'id' | 'maxRank' | 'startRank' | 'effect'> & {
  effect?: SkillEffect;
  startRank?: 0 | 1;
};

function node(
  id: SkillId,
  branch: SkillBranch,
  slot: SkillSlot,
  rankCosts: number[],
  requires: SkillId[],
  implemented = false,
  extra: Pick<SkillSeed, 'effect' | 'startRank'> = {},
): SkillDefinition {
  return {
    id,
    branch,
    slot,
    maxRank: rankCosts.length,
    rankCosts,
    requires,
    startRank: extra.startRank ?? 0,
    implemented,
    effect: extra.effect ?? { kind: 'none' },
  };
}

const MELEE_RANK_COSTS = [6, 6, 8, 8, 10, 10, 12, 14, 16, 18];

/** Candidate balance (Will capacity is 50); deliberately small so equipment stays the main source of power. */
const DEFINITIONS: SkillDefinition[] = [
  node('b_crest', 'bionic', 'crest', [0], [], true, { startRank: 1 }),
  node('b_strike', 'bionic', '1L', MELEE_RANK_COSTS, ['b_crest'], true, {
    effect: { kind: 'stat', stat: 'attack', perRank: 0.05 },
  }),
  node('b_guard', 'bionic', '1R', MELEE_RANK_COSTS, ['b_crest'], true, {
    effect: { kind: 'stat', stat: 'defense', perRank: 0.05 },
  }),
  node('b_heavy', 'bionic', '2L', [10, 14, 18], ['b_strike']),
  node('b_endure', 'bionic', '2R', [15, 20], ['b_guard']),
  node('b_dash', 'bionic', '3L', [12, 16, 20], ['b_heavy']),
  node('b_aim', 'bionic', '3R', [10, 12, 14, 16, 18], ['b_endure']),
  node('b_cap', 'bionic', 'cap', BRANCH_CAP_COSTS, ['b_dash', 'b_aim']),

  node('d_crest', 'demonic', 'crest', [10], [], true),
  node('d_curse', 'demonic', '1L', [8, 10, 12, 14, 16], ['d_crest']),
  node('d_blood', 'demonic', '1R', [10, 14, 18], ['d_crest']),
  node('d_fear', 'demonic', '2L', [10, 14, 18], ['d_curse']),
  node('d_shadow', 'demonic', '2R', [14, 20], ['d_blood']),
  node('d_devour', 'demonic', '3L', [14, 18, 22], ['d_fear']),
  node('d_sight', 'demonic', '3R', [12, 18], ['d_shadow']),
  node('d_cap', 'demonic', 'cap', BRANCH_CAP_COSTS, ['d_devour', 'd_sight']),

  node('a_crest', 'angelic', 'crest', [10], [], true),
  node('a_teleport', 'angelic', '1L', [10, 10, 12, 12, 14, 14, 16, 16, 18, 20], ['a_crest'], true, {
    effect: { kind: 'portal', willCostByRank: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1] },
  }),
  node('a_heal', 'angelic', '1R', [8, 12, 16], ['a_crest']),
  node('a_gate2', 'angelic', '2L', [25], ['a_teleport']),
  node('a_ward', 'angelic', '2R', [10, 14, 18], ['a_heal']),
  node('a_wings', 'angelic', '3L', [14, 20], ['a_gate2']),
  node('a_light', 'angelic', '3R', [10, 16], ['a_ward']),
  node('a_cap', 'angelic', 'cap', BRANCH_CAP_COSTS, ['a_wings', 'a_light']),
];

export const SKILLS = Object.fromEntries(
  DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<SkillId, SkillDefinition>;
