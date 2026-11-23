import type { EDimension } from '../../dimensions/dimensions';
import type { ERarityKind } from '../../abstraction/hexobject-abstraction';
import type { SkillId } from '../../skills/skill-content';
import type { RandomNumberGenerator } from '../../utils/random';
import type { ItemTypeDefinition } from '../token-content-schema';
import type {
  I18nKey,
  ItemTypeKey,
  SpriteKey,
  TBaseRealm,
  TMapTier,
  UniqueKey,
} from '../token-keys';
import type { DescriptionLine, ItemToken, TokenAttribute, TokenName } from '../token-schema';

export const TOKEN_GENERATOR_VERSION = 6;

export const TOKEN_STEPS = ['type', 'name', 'sprite', 'skills', 'price'] as const;
export type TTokenStep = (typeof TOKEN_STEPS)[number];

export const TOKEN_REFUSALS = [
  'BAD_SEED',
  'BAD_SOURCE_ID',
  'BAD_ITEM_INDEX',
  'SOURCE_ID_CONTAINS_SEED',
  'ALIEN_NOT_BASE',
  'UNKNOWN_TYPE',
  'UNKNOWN_BASE_ITEM',
  'BASE_ITEM_NOT_IN_DIMENSION',
  'TYPE_NOT_IN_REALM',
  'NO_TYPE_IN_REALM',
  'INVALID_TOKEN',
  'UNKNOWN_UNIQUE',
  'UNIQUE_NOT_IN_DIMENSION',
  'UNIQUE_ALREADY_OWNED',
] as const;
export type TTokenRefusalCode = (typeof TOKEN_REFUSALS)[number];

export interface TokenRefusal {
  code: TTokenRefusalCode;
  message: string;
}

export type TokenResult<T> = { ok: true; value: T } | { ok: false; refusal: TokenRefusal };

export function refuseToken(
  code: TTokenRefusalCode,
  message: string,
): { ok: false; refusal: TokenRefusal } {
  return { ok: false, refusal: { code, message } };
}

export interface GenerationContext {
  seed: string;
  sourceId: string;
  n: number;
  realm: ERarityKind;
  mapTier: TMapTier;
  type?: ItemTypeKey;
  baseKey?: string;
}

export interface TokenOverrides {
  attributes?: readonly TokenAttribute[];
  price?: number;
}

export interface UniqueGenerationContext {
  dimension?: EDimension;
  seed: string;
  sourceId: string;
  n: number;
  mapTier: TMapTier;
  ownedUniques: readonly UniqueKey[];
}

export interface TokenSheet {
  type: ItemTypeDefinition;
  realm: ERarityKind;
  mapTier: TMapTier;
  descriptionKey?: I18nKey;
}

export interface AttributeSheet {
  type: ItemTypeDefinition;
  origin: 'base' | 'unique';
  mapTier: TMapTier;
  attributes: readonly TokenAttribute[];
}

export interface NameRequest {
  type: ItemTypeDefinition;
  attributeCount: number;
}

export interface ITypePicker {
  pick(realm: TBaseRealm, key: ItemTypeKey): TokenResult<ItemTypeDefinition>;
}

export interface INameGenerator {
  generate(request: NameRequest, rng: RandomNumberGenerator): TokenName;
}

export interface ISpriteResolver {
  resolve(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): SpriteKey;
}

export interface IUniqueSpriteResolver {
  resolveUnique(uniqueKey: UniqueKey): SpriteKey;
}

export interface ISkillGenerator {
  generate(type: ItemTypeDefinition, rng: RandomNumberGenerator): SkillId[];
}

export interface IPriceGenerator {
  generate(realm: TBaseRealm, attributeCount: number, rng: RandomNumberGenerator): number;
}

export interface IDescriptionBuilder {
  build(sheet: TokenSheet): DescriptionLine[];
}

export interface ITokenValidator {
  validateAttributes(sheet: AttributeSheet): TokenResult<true>;
  validate(candidate: unknown): TokenResult<ItemToken>;
}
