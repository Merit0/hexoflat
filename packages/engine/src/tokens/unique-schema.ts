import { sharedWithSchema } from '../dimensions/availability';
import { dimensionSchema, tokenTypeOfDimension } from '../dimensions/dimensions';
import { z } from 'zod';
import { EQUIPMENT_ATTRIBUTES } from '../content/equipment-attributes.content';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { skillIdSchema } from '../skills/skill-content';
import {
  attributeKeySchema,
  i18nKeySchema,
  itemTypeKeySchema,
  uniqueKeySchema,
  WORD_KEY_ROOT,
  type UniqueKey,
} from './token-keys';

function distinct(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function uniqueTextKeys(uniqueKey: UniqueKey): { name: string; description: string } {
  const root = `${WORD_KEY_ROOT}.unique.${uniqueKey}`;
  return { name: `${root}.name`, description: `${root}.desc` };
}

const CATALOGUE_KEYS: ReadonlySet<string> = new Set(
  EQUIPMENT_ATTRIBUTES.map((attribute) => attribute.key),
);

export const authoredAttributeSchema = z
  .strictObject({
    attribute: attributeKeySchema.refine((key) => CATALOGUE_KEYS.has(key), {
      error: (issue) => `attribute ${String(issue.input)} is not in the attribute catalogue`,
    }),
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .refine((entry) => entry.min <= entry.max, 'min is above max');
export type AuthoredAttribute = z.infer<typeof authoredAttributeSchema>;

export const UNIQUE_ART = ['pending', 'ready'] as const;
export type TUniqueArt = (typeof UNIQUE_ART)[number];

export const uniqueTokenDefinitionSchema = z
  .strictObject({
    key: uniqueKeySchema,
    type: itemTypeKeySchema,
    tokenType: z.enum(ETokenType),
    dimension: dimensionSchema,
    sharedWith: sharedWithSchema.optional(),
    name: z.strictObject({ kind: z.literal('authored'), nameKey: i18nKeySchema }),
    descriptionKey: i18nKeySchema.optional(),
    authoredAttributes: z
      .array(authoredAttributeSchema)
      .refine((authored) => distinct(authored.map((entry) => entry.attribute)), {
        message: 'an attribute is listed twice',
      }),
    skills: z.array(skillIdSchema).refine(distinct, 'a skill is listed twice'),
    price: z.number().int().positive(),
    revision: z.number().int().positive(),
    art: z.enum(UNIQUE_ART).default('pending'),
  })
  .refine((definition) => tokenTypeOfDimension(definition.dimension) === definition.tokenType, {
    path: ['dimension'],
    message: 'Unique dimension differs from token type',
  });
export type UniqueTokenDefinition = z.output<typeof uniqueTokenDefinitionSchema>;
export type UniqueTokenContent = z.input<typeof uniqueTokenDefinitionSchema>;
