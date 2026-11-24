import { z } from 'zod';
import { tokenTypesWithTier, type TTokenTypeWithTier } from '../dimensions/dimensions';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_PART = '[a-z0-9]+(?:-[a-z0-9]+)*';

export const itemTypeKeySchema = z.string().regex(SLUG);
export const attributeKeySchema = z.string().regex(SLUG);
export const aspectKeySchema = z.string().regex(SLUG);
export const uniqueKeySchema = z.string().regex(SLUG);
export const adjectiveKeySchema = z.string().regex(SLUG);
export const i18nKeySchema = z.string().regex(/^content(?:\.[A-Za-z0-9_-]+)+$/);
export const spriteKeySchema = z.string().regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const PLACEHOLDER_SPRITE_KEY = '_placeholder';

export const TOKEN_SOURCE_KINDS = [
  'chest',
  'grave',
  'quest',
  'shop',
  'upcast',
  'grant',
  'repair',
  'dev',
  'test',
] as const;
export type TTokenSourceKind = (typeof TOKEN_SOURCE_KINDS)[number];

const SOURCE_ID_PART = `${SLUG_PART}:[a-z0-9._-]+`;
export const tokenSourceIdSchema = z
  .string()
  .max(4096)
  .regex(new RegExp(`^${SOURCE_ID_PART}$`));
export const itemTokenIdSchema = z
  .string()
  .regex(new RegExp(`^${SOURCE_ID_PART}:(?:0|[1-9]\\d*)$`));

export function itemTokenIdOf(sourceId: string, n: number): string {
  return `${sourceId}:${n}`;
}

export type ItemTypeKey = z.infer<typeof itemTypeKeySchema>;
export type AttributeKey = z.infer<typeof attributeKeySchema>;
export type AspectKey = z.infer<typeof aspectKeySchema>;
export type UniqueKey = z.infer<typeof uniqueKeySchema>;
export type AdjectiveKey = z.infer<typeof adjectiveKeySchema>;
export type I18nKey = z.infer<typeof i18nKeySchema>;
export type SpriteKey = z.infer<typeof spriteKeySchema>;
export type ItemTokenId = z.infer<typeof itemTokenIdSchema>;
export type TokenSourceId = z.infer<typeof tokenSourceIdSchema>;

export const WORD_SLOTS = ['prefix', 'suffix', 'noun'] as const;
export type TWordSlot = (typeof WORD_SLOTS)[number];

export const WORD_KEY_ROOT = 'content.tokens';

export function wordKeyOf(slot: TWordSlot, id: string): string {
  return `${WORD_KEY_ROOT}.${slot}.${id}`;
}

export function wordKeySchemaFor(slot: TWordSlot) {
  return z.string().regex(new RegExp(`^content\\.tokens\\.${slot}\\.${SLUG_PART}$`));
}

export const wordKeySchema = z
  .string()
  .regex(new RegExp(`^content\\.tokens\\.(?:${WORD_SLOTS.join('|')})\\.${SLUG_PART}$`));
export type WordKey = z.infer<typeof wordKeySchema>;

export type TBaseTokenType = TTokenTypeWithTier<'base'>;
export const BASE_TOKEN_TYPES: readonly TBaseTokenType[] = Object.freeze(
  tokenTypesWithTier('base'),
);
export const baseTokenTypeSchema = z.enum(BASE_TOKEN_TYPES);

export const MAP_TIERS = [1, 2, 3, 4] as const;
export type TMapTier = (typeof MAP_TIERS)[number];
export const mapTierSchema = z.literal(MAP_TIERS);
