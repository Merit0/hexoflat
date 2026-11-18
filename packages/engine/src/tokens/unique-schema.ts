import { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { skillIdSchema } from '../skills/skill-content';
import { MAX_BASE_TOKEN_ATTRIBUTES } from './factory/attribute-generator';
import {
  i18nKeySchema,
  itemTypeKeySchema,
  uniqueKeySchema,
  WORD_KEY_ROOT,
  type SpriteKey,
  type UniqueKey,
} from './token-keys';
import { tokenAttributeSchema } from './token-schema';

function distinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const UNIQUE_SPRITE_PREFIX = 'unique-';

export function uniqueSpriteKey(uniqueKey: UniqueKey): SpriteKey {
  return `${UNIQUE_SPRITE_PREFIX}${uniqueKey}`;
}

export function uniqueTextKeys(uniqueKey: UniqueKey): { name: string; description: string } {
  const root = `${WORD_KEY_ROOT}.unique.${uniqueKey}`;
  return { name: `${root}.name`, description: `${root}.desc` };
}

export const uniqueTokenDefinitionSchema = z.strictObject({
  key: uniqueKeySchema,
  type: itemTypeKeySchema,
  rarity: z.enum(ERarityKind),
  name: z.strictObject({ kind: z.literal('authored'), nameKey: i18nKeySchema }),
  descriptionKey: i18nKeySchema.optional(),
  attributes: z
    .array(tokenAttributeSchema)
    .refine((attributes) => distinct(attributes.map((attribute) => attribute.key)), {
      message: 'an attribute is listed twice',
    }),
  skills: z.array(skillIdSchema).refine(distinct, 'a skill is listed twice'),
  price: z.number().int().positive(),
  rolled: z
    .strictObject({
      attributes: z.number().int().min(1).max(MAX_BASE_TOKEN_ATTRIBUTES).optional(),
    })
    .optional(),
  revision: z.number().int().positive(),
});
export type UniqueTokenDefinition = z.infer<typeof uniqueTokenDefinitionSchema>;
