import { z } from 'zod';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { skillIdSchema } from '../skills/skill-content';
import {
  adjectiveKeySchema,
  aspectKeySchema,
  attributeKeySchema,
  i18nKeySchema,
  itemTokenIdSchema,
  itemTypeKeySchema,
  mapTierSchema,
  spriteKeySchema,
  TOKEN_ORIGINS,
  uniqueKeySchema,
  wordKeySchemaFor,
} from './token-keys';

export const tokenExtensionsSchema = z.strictObject({
  aspects: z.array(aspectKeySchema),
  heroGrade: z.number().int().min(1).nullable(),
});
export type TokenExtensions = z.infer<typeof tokenExtensionsSchema>;

export function emptyTokenExtensions(): TokenExtensions {
  return { aspects: [], heroGrade: null };
}

export const tokenNameSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('generated'),
    prefix: wordKeySchemaFor('prefix').optional(),
    noun: itemTypeKeySchema,
    suffix: wordKeySchemaFor('suffix').optional(),
  }),
  z.strictObject({
    kind: z.literal('adjective'),
    adjective: adjectiveKeySchema,
    noun: itemTypeKeySchema,
  }),
  z.strictObject({
    kind: z.literal('noun'),
    noun: itemTypeKeySchema,
  }),
  z.strictObject({
    kind: z.literal('authored'),
    nameKey: i18nKeySchema,
  }),
]);
export type TokenName = z.infer<typeof tokenNameSchema>;

export const descriptionLineSchema = z.strictObject({
  key: i18nKeySchema,
  params: z.record(z.string().min(1), z.union([z.string(), z.number()])),
});
export type DescriptionLine = z.infer<typeof descriptionLineSchema>;

export const tokenAttributeSchema = z.strictObject({
  key: attributeKeySchema,
  value: z.number().int().positive(),
});
export type TokenAttribute = z.infer<typeof tokenAttributeSchema>;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export const itemTokenSchema = z
  .strictObject({
    id: itemTokenIdSchema,
    origin: z.enum(TOKEN_ORIGINS),
    uniqueKey: uniqueKeySchema.optional(),
    type: itemTypeKeySchema,
    rarity: z.enum(ERarityKind),
    name: tokenNameSchema,
    description: z.array(descriptionLineSchema),
    attributes: z.array(tokenAttributeSchema),
    skills: z.array(skillIdSchema),
    price: z.number().int().positive(),
    sprite: spriteKeySchema,
    mapTier: mapTierSchema,
    generatorVersion: z.number().int().positive(),
    ext: tokenExtensionsSchema,
  })
  .superRefine((token, ctx) => {
    const unique = token.origin === 'unique';
    if (unique !== (token.uniqueKey !== undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['uniqueKey'],
        message: 'uniqueKey is set only on a unique token',
      });
    }
    if (!unique && token.rarity === ERarityKind.GOD_EXECUTOR) {
      ctx.addIssue({
        code: 'custom',
        path: ['rarity'],
        message: 'god-executor tokens are unique only',
      });
    }
    if (token.name.kind === 'generated' && !token.name.prefix && !token.name.suffix) {
      ctx.addIssue({
        code: 'custom',
        path: ['name'],
        message: 'a generated name needs a prefix or a suffix',
      });
    }
    if (token.name.kind !== 'authored' && token.name.noun !== token.type) {
      ctx.addIssue({
        code: 'custom',
        path: ['name', 'noun'],
        message: 'noun differs from the token type',
      });
    }
    if (hasDuplicates(token.attributes.map((attribute) => attribute.key))) {
      ctx.addIssue({
        code: 'custom',
        path: ['attributes'],
        message: 'an attribute is listed twice',
      });
    }
    if (hasDuplicates(token.skills)) {
      ctx.addIssue({ code: 'custom', path: ['skills'], message: 'a skill is listed twice' });
    }
  });
export type ItemToken = z.infer<typeof itemTokenSchema>;

const KNOWN_ITEM_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

export const itemTokenEntrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('stack'),
    itemKey: z.string().refine((key) => KNOWN_ITEM_KEYS.has(key), 'unknown hexobject key'),
    amount: z.number().int().positive(),
  }),
  z.strictObject({
    kind: z.literal('token'),
    token: itemTokenSchema,
  }),
]);
export type ItemTokenEntry = z.infer<typeof itemTokenEntrySchema>;
