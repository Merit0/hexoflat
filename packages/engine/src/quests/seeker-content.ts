import { z } from 'zod';
import { KNOWLEDGE_RULES } from '../knowledge/math';
import { RulePoolEntrySchema } from './sequences/rules';

export const TreasureSeekerParamsSchema = z
  .object({
    steps: z.number().int().min(4),
    stepCost: z.number().int().min(1),
    backMultiplier: z.number().int().min(1),
    hintSteps: z.number().int().min(1),
    maxDigits: z.number().int().min(1).max(6),
    rulePool: z.array(RulePoolEntrySchema).min(1),
  })
  .strict();
export type TreasureSeekerParams = z.infer<typeof TreasureSeekerParamsSchema>;

export const SeekerCardSchema = z
  .object({
    id: z.string().min(1),
    nameKey: z.string().min(1),
    descKey: z.string().min(1),
    tableRule: z.string().min(1),
    entryWill: z.number().int().min(1),
    requiresCleanOf: z.string().min(1).nullable(),
    params: TreasureSeekerParamsSchema,
  })
  .strict();
export type SeekerCard = z.infer<typeof SeekerCardSchema>;

const MAX_DIGITS = 3;
const BACK_MULTIPLIER = 3;
const ENTRY_WILL = 20;

export const SEEKER_CARDS: readonly SeekerCard[] = [
  {
    id: 'seeker-1',
    nameKey: 'quest.seeker-1.name',
    descKey: 'quest.seeker-1.desc',
    tableRule: 'quest.seeker-1.table',
    entryWill: ENTRY_WILL,
    requiresCleanOf: null,
    params: {
      steps: 10,
      stepCost: 1,
      backMultiplier: BACK_MULTIPLIER,
      hintSteps: 4,
      maxDigits: MAX_DIGITS,
      rulePool: [{ kind: 'arith', weight: 1, params: { start: 1, step: 1 } }],
    },
  },
  {
    id: 'seeker-2',
    nameKey: 'quest.seeker-2.name',
    descKey: 'quest.seeker-2.desc',
    tableRule: 'quest.seeker-2.table',
    entryWill: ENTRY_WILL,
    requiresCleanOf: 'seeker-1',
    params: {
      steps: 10,
      stepCost: 1,
      backMultiplier: BACK_MULTIPLIER,
      hintSteps: 3,
      maxDigits: MAX_DIGITS,
      rulePool: [
        {
          kind: 'arith',
          weight: 5,
          params: { start: { min: 0, max: 20 }, step: [2, 3, 4, 5, 10] },
        },
        {
          kind: 'arith',
          weight: 4,
          params: { start: { min: 60, max: 100 }, step: [-2, -3, -4, -5] },
        },
      ],
    },
  },
  {
    id: 'seeker-3',
    nameKey: 'quest.seeker-3.name',
    descKey: 'quest.seeker-3.desc',
    tableRule: 'quest.seeker-3.table',
    entryWill: ENTRY_WILL,
    requiresCleanOf: 'seeker-2',
    params: {
      steps: 8,
      stepCost: 2,
      backMultiplier: BACK_MULTIPLIER,
      hintSteps: 4,
      maxDigits: MAX_DIGITS,
      rulePool: [
        {
          kind: 'arith',
          weight: 1,
          params: { start: { min: 1, max: 20 }, step: [6, 7, 8, 9] },
        },
        { kind: 'geom', weight: 1, params: { start: { min: 1, max: 5 }, ratio: 2 } },
        {
          kind: 'alternating',
          weight: 1,
          params: {
            start: { min: 1, max: 5 },
            stepA: { min: 1, max: 5 },
            stepB: { min: 1, max: 5 },
          },
        },
        {
          kind: 'growingStep',
          weight: 1,
          params: { start: { min: 1, max: 5 }, step0: 1, inc: 1 },
        },
      ],
    },
  },
];

export function seekerCardOf(id: string): SeekerCard | null {
  return SEEKER_CARDS.find((card) => card.id === id) ?? null;
}

export function seekerWorstCaseWill(card: SeekerCard): number {
  const { steps, stepCost, backMultiplier } = card.params;
  return card.entryWill + (steps + 1 + backMultiplier) * stepCost;
}

export function seekerCleanWill(card: SeekerCard): number {
  return card.entryWill + card.params.steps * card.params.stepCost;
}

export function seekerCardFailures(
  cards: readonly SeekerCard[] = SEEKER_CARDS,
  capacity: number = KNOWLEDGE_RULES.capacity,
): string[] {
  const failures: string[] = [];
  const ids = new Set<string>();
  for (const card of cards) {
    const parsed = SeekerCardSchema.safeParse(card);
    if (!parsed.success) failures.push(`${card.id}: ${parsed.error.message}`);
    if (ids.has(card.id)) failures.push(`${card.id}: duplicate id`);
    ids.add(card.id);
    if (seekerWorstCaseWill(card) > capacity) failures.push(`${card.id}: over Will capacity`);
    if (card.params.hintSteps > card.params.steps - 2) failures.push(`${card.id}: hint too long`);
    if (card.requiresCleanOf && !cards.some((c) => c.id === card.requiresCleanOf)) {
      failures.push(`${card.id}: unknown requirement ${card.requiresCleanOf}`);
    }
  }
  return failures;
}
