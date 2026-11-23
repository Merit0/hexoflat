import { z } from 'zod';
import { weightedLootEntrySchema, type WeightedLootEntry } from '../loot/loot-table';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';

export const QUEST_GENERATOR_VERSION = 1;

const positiveInteger = z.number().int().positive();
const contentId = z.string().regex(/^[a-z][a-z0-9-]*$/);
const rewardProfileSchema = z.strictObject({
  maxSellValue: positiveInteger,
  entries: z.array(weightedLootEntrySchema).min(1),
  fallbackCoins: positiveInteger.optional(),
});
const variantSchema = z.strictObject({
  id: contentId,
  target: positiveInteger,
  reward: rewardProfileSchema.optional(),
});
export const questGenerationProfileSchema = z.strictObject({
  templateId: contentId,
  category: z.enum(['gather', 'combat', 'learn', 'exp']),
  variants: z.array(variantSchema).min(1),
});

export type QuestGenerationProfile = z.infer<typeof questGenerationProfileSchema>;
export type QuestGenerationVariant = z.infer<typeof variantSchema>;
export type QuestRewardProfile = z.infer<typeof rewardProfileSchema>;

function coins(min: number, max: number, weight = 1): WeightedLootEntry {
  return { itemKey: HEXOBJECT_KEYS.COINS, amount: [min, max], weight };
}

export const QUEST_GENERATION_PROFILES: readonly QuestGenerationProfile[] = [
  {
    templateId: 'woodcutter',
    category: 'gather',
    variants: [
      { id: 'evening-kindling', target: 7, reward: { maxSellValue: 18, entries: [coins(12, 18)] } },
      {
        id: 'camp-firewood',
        target: 12,
        reward: {
          maxSellValue: 32,
          entries: [
            coins(22, 32, 4),
            { itemKey: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: [1, 2], weight: 1 },
          ],
        },
      },
      {
        id: 'winter-supply',
        target: 15,
        reward: {
          maxSellValue: 120,
          fallbackCoins: 42,
          entries: [
            coins(32, 42, 5),
            { itemKey: HEXOBJECT_KEYS.AXE, amount: [1, 1], weight: 1 },
            { itemKey: HEXOBJECT_KEYS.SWORD, amount: [1, 1], weight: 1 },
          ],
        },
      },
    ],
  },
  {
    templateId: 'stonebreaker',
    category: 'gather',
    variants: [
      { id: 'trail-stones', target: 5, reward: { maxSellValue: 22, entries: [coins(16, 22)] } },
      { id: 'camp-wall', target: 8, reward: { maxSellValue: 30, entries: [coins(24, 30)] } },
    ],
  },
  {
    templateId: 'scholar',
    category: 'learn',
    variants: [
      { id: 'first-lesson', target: 9, reward: { maxSellValue: 14, entries: [coins(9, 14)] } },
      { id: 'will-study', target: 15, reward: { maxSellValue: 20, entries: [coins(15, 20)] } },
    ],
  },
  {
    templateId: 'bone-hunter',
    category: 'combat',
    variants: [
      {
        id: 'quiet-crypt',
        target: 3,
        reward: {
          maxSellValue: 320,
          entries: [{ itemKey: HEXOBJECT_KEYS.SHIELD, amount: [1, 1], weight: 1 }],
        },
      },
    ],
  },
  {
    templateId: 'seeker-1',
    category: 'exp',
    variants: [
      { id: 'mist-trail', target: 8 },
      { id: 'first-trail', target: 10 },
    ],
  },
  {
    templateId: 'seeker-2',
    category: 'exp',
    variants: [
      { id: 'uneven-trail', target: 8 },
      { id: 'jumping-trail', target: 10 },
    ],
  },
  {
    templateId: 'seeker-3',
    category: 'exp',
    variants: [
      { id: 'hidden-trail', target: 7 },
      { id: 'twisted-trail', target: 8 },
    ],
  },
];

export function questOfferTextKeys(templateId: string, variantId: string) {
  const group = `quest.generated.${templateId}`;
  return {
    nameKey: `${group}.names.${variantId}`,
    descKey: `${group}.desc`,
    tableRule: `${group}.goal`,
    howKey: `${group}.how`,
  };
}

export function generatedQuestLocaleKeys(): string[] {
  return QUEST_GENERATION_PROFILES.flatMap(({ templateId, variants }) =>
    variants.flatMap(({ id }) => Object.values(questOfferTextKeys(templateId, id))),
  );
}
