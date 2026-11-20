import { z } from 'zod';
import { EQUIP_SLOTS } from '../../abstraction/hexobject-abstraction';

export function distinctValues<T>(values: readonly T[]): boolean {
  return new Set(values).size === values.length;
}

export const ITEM_GROUPS = ['weapon', 'defense', 'clothing', 'jewelry', 'burden', 'charm'] as const;
export type TItemGroup = (typeof ITEM_GROUPS)[number];
export const itemGroupSchema = z.enum(ITEM_GROUPS);

export const EQUIPMENT_SLOTS = [...EQUIP_SLOTS, 'any'] as const;
export type TEquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export const equipmentSlotSchema = z.enum(EQUIPMENT_SLOTS);

export const MATERIALS = ['wood', 'iron', 'bronze', 'copper', 'leather', 'bone', 'stone'] as const;
export type TMaterial = (typeof MATERIALS)[number];
export const materialSchema = z.enum(MATERIALS);

export const NOUN_GENDERS = ['m', 'f', 'n', 'pl'] as const;
export type TNounGender = (typeof NOUN_GENDERS)[number];
export const nounGenderSchema = z.enum(NOUN_GENDERS);

const baseValueSchema = z.number().int().positive();

export const itemTypeBaseSchema = z.strictObject({
  damage: baseValueSchema.optional(),
  defense: baseValueSchema.optional(),
  blockSides: baseValueSchema.optional(),
  hearts: baseValueSchema.optional(),
  will: baseValueSchema.optional(),
});
export type ItemTypeBase = z.infer<typeof itemTypeBaseSchema>;

export const equipmentTypeFieldShape = {
  group: itemGroupSchema,
  gender: nounGenderSchema,
  materials: z.array(materialSchema).min(1).refine(distinctValues, 'a material is listed twice'),
  enabled: z.boolean(),
  base: itemTypeBaseSchema,
};

export const HERO_STATS = [
  'maxHearts',
  'maxWill',
  'critPoints',
  'critDamage',
  'blockSides',
  'thorns',
  'absorb',
  'stepFreeEvery',
  'useWillDiscount',
  'shopBuyDiscountPct',
  'answerWillReward',
  'fogRadius',
  'graveLootBonus',
  'harvestBonus',
  'strikeForce',
  'pushMass',
  'carryKg',
] as const;
export type THeroStat = (typeof HERO_STATS)[number];
export const heroStatSchema = z.enum(HERO_STATS);

export const STAT_AGGREGATES = ['sum', 'min', 'max'] as const;
export type TStatAggregate = (typeof STAT_AGGREGATES)[number];

export const ATTRIBUTE_SCOPES = ['hero', 'item'] as const;
export type TAttributeScope = (typeof ATTRIBUTE_SCOPES)[number];

export const ATTRIBUTE_FORMATS = ['plus', 'minus', 'pct', 'sec', 'hearts', 'plain'] as const;
export type TAttributeFormat = (typeof ATTRIBUTE_FORMATS)[number];

export const ADJECTIVE_BANDS = ['poor', 'plain', 'fine'] as const;
export type TAdjectiveBand = (typeof ADJECTIVE_BANDS)[number];

export const ATTRIBUTE_PROFILE_TIERS = ['tier-1', 'tier-2', 'tier-3', 'tier-4'] as const;
export type TAttributeProfileTier = (typeof ATTRIBUTE_PROFILE_TIERS)[number];
