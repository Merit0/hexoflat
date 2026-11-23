import { z } from 'zod';
import { attributeKeySchema } from '../token-keys';
import {
  ATTRIBUTE_PROFILE_TIERS,
  ITEM_GROUPS,
  type TAttributeProfileTier,
  type TItemGroup,
} from './equipment-keys';

export const COUNT_WEIGHT_TOTAL = 100;

const weightSchema = z.number().int().positive();

export const groupWeightsSchema = z
  .strictObject(
    Object.fromEntries(ITEM_GROUPS.map((group) => [group, weightSchema.optional()])) as Record<
      TItemGroup,
      z.ZodOptional<typeof weightSchema>
    >,
  )
  .refine((weights) => Object.keys(weights).length > 0, 'a profile entry needs a group weight');
export type GroupWeights = z.infer<typeof groupWeightsSchema>;

export const profileAttributeSchema = z
  .strictObject({
    weight: groupWeightsSchema,
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    step: z.number().int().positive(),
  })
  .refine((entry) => entry.min <= entry.max, 'min is above max')
  .refine((entry) => (entry.max - entry.min) % entry.step === 0, 'max is not reached by step');
export type ProfileAttribute = z.infer<typeof profileAttributeSchema>;

export const attributeProfileSchema = z
  .strictObject({
    maxCount: z.number().int().nonnegative(),
    countWeights: z.array(z.number().int().nonnegative()),
    attributes: z.record(attributeKeySchema, profileAttributeSchema),
  })
  .refine(
    (profile) => profile.countWeights.length === profile.maxCount + 1,
    'countWeights needs one weight for every count from 0 to maxCount',
  )
  .refine(
    (profile) =>
      profile.countWeights.reduce((sum, weight) => sum + weight, 0) === COUNT_WEIGHT_TOTAL,
    `countWeights must sum to ${COUNT_WEIGHT_TOTAL}`,
  );
export type AttributeProfile = z.infer<typeof attributeProfileSchema>;

export const attributeProfilesSchema = z.strictObject(
  Object.fromEntries(
    ATTRIBUTE_PROFILE_TIERS.map((tier) => [tier, attributeProfileSchema]),
  ) as Record<TAttributeProfileTier, typeof attributeProfileSchema>,
);
export type AttributeProfiles = z.infer<typeof attributeProfilesSchema>;
