import type { ERarityKind } from '../../abstraction/hexobject-abstraction';
import type { SkillId } from '../../skills/skill-content';
import type { RandomNumberGenerator } from '../../utils/random';
import type { ItemTypeDefinition } from '../token-content-schema';
import type { ItemTypeKey, SpriteKey, TBaseRealm, TMapTier } from '../token-keys';
import type { DescriptionLine, ItemToken, TokenAttribute, TokenName } from '../token-schema';

export const TOKEN_GENERATOR_VERSION = 1;

export const TOKEN_STEPS = ['type', 'name', 'sprite', 'attributes', 'skills', 'price'] as const;
export type TTokenStep = (typeof TOKEN_STEPS)[number];

export const TOKEN_REFUSALS = [
  'BAD_SOURCE_ID',
  'BAD_ITEM_INDEX',
  'GOD_EXECUTOR_NOT_BASE',
  'UNKNOWN_TYPE',
  'TYPE_NOT_IN_REALM',
  'NO_TYPE_IN_REALM',
  'INVALID_TOKEN',
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
}

export interface BaseTokenSheet {
  type: ItemTypeDefinition;
  realm: TBaseRealm;
  mapTier: TMapTier;
  attributes: readonly TokenAttribute[];
}

export interface ITypePicker {
  pick(
    realm: TBaseRealm,
    requested: ItemTypeKey | undefined,
    rng: RandomNumberGenerator,
  ): TokenResult<ItemTypeDefinition>;
}

export interface INameGenerator {
  generate(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): TokenName;
}

export interface ISpriteResolver {
  resolve(type: ItemTypeDefinition, realm: TBaseRealm, rng: RandomNumberGenerator): SpriteKey;
}

export interface IAttributeGenerator {
  generate(
    type: ItemTypeDefinition,
    mapTier: TMapTier,
    rng: RandomNumberGenerator,
  ): TokenAttribute[];
}

export interface ISkillGenerator {
  generate(type: ItemTypeDefinition, rng: RandomNumberGenerator): SkillId[];
}

export interface IPriceGenerator {
  generate(realm: TBaseRealm, rng: RandomNumberGenerator): number;
}

export interface IDescriptionBuilder {
  build(sheet: BaseTokenSheet): DescriptionLine[];
}

export interface ITokenValidator {
  validate(candidate: unknown): TokenResult<ItemToken>;
}
