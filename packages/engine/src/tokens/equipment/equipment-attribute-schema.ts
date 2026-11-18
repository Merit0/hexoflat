import { z } from 'zod';
import { attributeKeySchema, i18nKeySchema, itemTypeKeySchema, WORD_KEY_ROOT } from '../token-keys';
import {
  ATTRIBUTE_FORMATS,
  ATTRIBUTE_SCOPES,
  distinctValues,
  heroStatSchema,
  itemGroupSchema,
  STAT_AGGREGATES,
} from './equipment-keys';

export function attributeLabelKey(key: string): string {
  return `${WORD_KEY_ROOT}.attrLabel.${key}`;
}

export function attributeHintKey(key: string): string {
  return `${WORD_KEY_ROOT}.attrHint.${key}`;
}

export const attributeDisplaySchema = z.strictObject({
  labelKey: i18nKeySchema,
  hintKey: i18nKeySchema,
  icon: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  format: z.enum(ATTRIBUTE_FORMATS),
});
export type AttributeDisplay = z.infer<typeof attributeDisplaySchema>;

export const equipmentAttributeDefinitionSchema = z
  .strictObject({
    key: attributeKeySchema,
    groups: z.array(itemGroupSchema).min(1).refine(distinctValues, 'a group is listed twice'),
    onlyTypes: z
      .array(itemTypeKeySchema)
      .min(1)
      .refine(distinctValues, 'a type is listed twice')
      .optional(),
    requires: z.strictObject({ tool: z.literal(true) }).optional(),
    stat: heroStatSchema.nullable(),
    aggregate: z.enum(STAT_AGGREGATES),
    scope: z.enum(ATTRIBUTE_SCOPES),
    cap: z.number().int().positive().optional(),
    display: attributeDisplaySchema,
    implemented: z.boolean(),
    deprecated: z.boolean().optional(),
  })
  .superRefine((attribute, ctx) => {
    if (attribute.stat === null && attribute.implemented) {
      ctx.addIssue({
        code: 'custom',
        path: ['stat'],
        message: 'an implemented attribute needs a hero stat',
      });
    }
    if (attribute.display.labelKey !== attributeLabelKey(attribute.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['display', 'labelKey'],
        message: `label key must be ${attributeLabelKey(attribute.key)}`,
      });
    }
    if (attribute.display.hintKey !== attributeHintKey(attribute.key)) {
      ctx.addIssue({
        code: 'custom',
        path: ['display', 'hintKey'],
        message: `hint key must be ${attributeHintKey(attribute.key)}`,
      });
    }
  });
export type EquipmentAttributeDefinition = z.infer<typeof equipmentAttributeDefinitionSchema>;
