import { uniqueAvailableInDimension } from '../../dimensions/availability';
import { pickBaseItem } from './base-item-picker';
import type { BaseItemRegistry } from '../base-item-registry';
import { dimensionOfTokenType, tokenTypeAllowsTier } from '../../dimensions/dimensions';
import { decodedSourceId } from '../source-id';
import { ETokenType } from '../../abstraction/hexobject-abstraction';
import { deriveStream } from '../../utils/random-seeded';
import {
  itemTokenIdOf,
  tokenSourceIdSchema,
  mapTierSchema,
  type TBaseTokenType,
} from '../token-keys';
import type { TypeRegistry, UniqueRegistry } from '../registries';
import { emptyTokenExtensions, type ItemToken } from '../token-schema';
import { rollAuthoredAttributes, uniqueInstanceId } from '../unique-instance';
import type { UniqueTokenDefinition } from '../unique-schema';
import type { IAttributeGenerator as IEquipmentAttributeGenerator } from '../equipment/generator/generator-contracts';
import { seededRandomStreams } from '../equipment/generator/attribute-streams';
import {
  refuseToken,
  TOKEN_GENERATOR_VERSION,
  type GenerationContext,
  type IDescriptionBuilder,
  type INameGenerator,
  type IPriceGenerator,
  type ISkillGenerator,
  type ISpriteResolver,
  type ITokenValidator,
  type ITypePicker,
  type TokenOverrides,
  type TokenResult,
  type TTokenStep,
  type UniqueGenerationContext,
} from './token-generation';

export interface TokenFactoryParts {
  baseItems: BaseItemRegistry;
  typePicker: ITypePicker;
  nameGenerator: INameGenerator;
  spriteResolver: ISpriteResolver;
  attributeGenerator: IEquipmentAttributeGenerator;
  uniqueAttributeGenerator: IEquipmentAttributeGenerator;
  skillGenerator: ISkillGenerator;
  priceGenerator: IPriceGenerator;
  descriptionBuilder: IDescriptionBuilder;
  validator: ITokenValidator;
}

export interface UniqueTokenParts {
  types: TypeRegistry;
  uniques: UniqueRegistry;
}

export function tokenStreamLabel(id: string, step: TTokenStep): string {
  return `token:${id}:${step}`;
}

function baseTokenTypeOf(tokenType: ETokenType): TBaseTokenType | null {
  return tokenTypeAllowsTier(tokenType, 'base') ? (tokenType as TBaseTokenType) : null;
}

function plainText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function sourceIdContainsSeed(sourceId: string, seed: string): boolean {
  if (seed.length < 16) return false;
  const normalized = plainText(seed);
  const decoded = decodedSourceId(sourceId);
  return (
    decoded.includes(seed) || (normalized.length >= 16 && plainText(decoded).includes(normalized))
  );
}

function sourceRefusal(ctx: {
  seed: string;
  sourceId: string;
  n: number;
  mapTier: number;
}): TokenResult<never> | null {
  if (typeof ctx.seed !== 'string' || !ctx.seed.trim() || ctx.seed.length > 4096)
    return refuseToken('BAD_SEED', 'A bounded nonempty seed is required');
  if (!tokenSourceIdSchema.safeParse(ctx.sourceId).success) {
    return refuseToken('BAD_SOURCE_ID', 'source id must be <kind>:<key>');
  }
  if (!Number.isSafeInteger(ctx.n) || ctx.n < 0) {
    return refuseToken('BAD_ITEM_INDEX', `item index ${ctx.n} is not a whole number from 0`);
  }
  if (!mapTierSchema.safeParse(ctx.mapTier).success)
    return refuseToken('INVALID_TOKEN', 'Invalid source tier');
  if (sourceIdContainsSeed(ctx.sourceId, ctx.seed)) {
    return refuseToken('SOURCE_ID_CONTAINS_SEED', 'the source id must not contain the seed');
  }
  return null;
}

export class TokenFactory {
  constructor(
    private readonly parts: TokenFactoryParts,
    private readonly uniqueParts: UniqueTokenParts | null = null,
  ) {}

  createBase(ctx: GenerationContext, overrides: TokenOverrides = {}): TokenResult<ItemToken> {
    const refusal = sourceRefusal(ctx);
    if (refusal) return refusal;
    const tokenType = baseTokenTypeOf(ctx.tokenType);
    if (tokenType === null) {
      return refuseToken('ALIEN_NOT_BASE', `${ctx.tokenType} items are unique only`);
    }
    const id = itemTokenIdOf(ctx.sourceId, ctx.n);
    const stream = (step: TTokenStep) => deriveStream(ctx.seed, tokenStreamLabel(id, step));
    const base = pickBaseItem(this.parts.baseItems, ctx, stream('type'));
    if (!base.ok) return base;
    const picked = this.parts.typePicker.pick(tokenType, base.value.type);
    if (!picked.ok) return picked;
    const type = picked.value;
    if (!type.group) return refuseToken('INVALID_TOKEN', `item type "${type.key}" has no group`);
    const attributes = overrides.attributes
      ? overrides.attributes.map((attribute) => ({ ...attribute }))
      : this.parts.attributeGenerator.generate({
          allowedKeys: base.value.attributes,
          level: ctx.mapTier,
          group: type.group,
          type,
          tokenId: id,
          rng: seededRandomStreams(ctx.seed),
        });
    const attributeCount = attributes.length;
    return this.parts.validator.validate({
      id,
      tier: 'base',
      baseKey: base.value.key,
      type: type.key,
      tokenType: tokenType,
      dimension: dimensionOfTokenType(tokenType),
      name: this.parts.nameGenerator.generate({ type, attributeCount }, stream('name')),
      description: this.parts.descriptionBuilder.build({ type, tokenType, mapTier: ctx.mapTier }),
      attributes,
      skills: this.parts.skillGenerator.generate(type, stream('skills')),
      price:
        overrides.price ??
        this.parts.priceGenerator.generate(tokenType, attributeCount, stream('price')),
      sprite: this.parts.spriteResolver.resolve(type, tokenType, stream('sprite')),
      mapTier: ctx.mapTier,
      generatorVersion: TOKEN_GENERATOR_VERSION,
      ext: emptyTokenExtensions(),
    });
  }

  createUnique(uniqueKey: string, ctx: UniqueGenerationContext): TokenResult<ItemToken> {
    const refusal = sourceRefusal(ctx);
    if (refusal) return refusal;
    const unique = this.uniqueParts;
    if (!unique?.uniques.has(uniqueKey)) {
      return refuseToken('UNKNOWN_UNIQUE', `unique "${uniqueKey}" is not in the UniqueRegistry`);
    }
    const definition = unique.uniques.get(uniqueKey);
    if (ctx.dimension !== undefined && !uniqueAvailableInDimension(definition, ctx.dimension))
      return refuseToken('UNIQUE_NOT_IN_DIMENSION', 'Unique is outside the source dimension pool');
    if (!unique.types.has(definition.type)) {
      return refuseToken('UNKNOWN_TYPE', `item type "${definition.type}" is not in the registry`);
    }
    return this.buildUnique(definition, unique, ctx);
  }

  private buildUnique(
    definition: UniqueTokenDefinition,
    unique: UniqueTokenParts,
    ctx: UniqueGenerationContext,
  ): TokenResult<ItemToken> {
    const id = itemTokenIdOf(ctx.sourceId, ctx.n);
    const type = unique.types.get(definition.type);
    if (!type.group) return refuseToken('INVALID_TOKEN', `item type "${type.key}" has no group`);
    const rng = seededRandomStreams(ctx.seed);
    const generated = this.parts.uniqueAttributeGenerator.generate({
      authoredKeys: definition.authoredAttributes.map((entry) => entry.attribute),
      level: ctx.mapTier,
      group: type.group,
      type,
      tokenId: id,
      rng,
    });
    const authored = rollAuthoredAttributes(definition.authoredAttributes, id, rng);
    return this.parts.validator.validate({
      id,
      tier: 'unique',
      uniqueKey: definition.key,
      instanceId: uniqueInstanceId(ctx.seed, id),
      type: type.key,
      tokenType: definition.tokenType,
      dimension: definition.dimension,
      name: { ...definition.name },
      description: this.parts.descriptionBuilder.build({
        type,
        tokenType: definition.tokenType,
        mapTier: ctx.mapTier,
        descriptionKey: definition.descriptionKey,
      }),
      attributes: [...generated, ...authored],
      skills: [...definition.skills],
      price: definition.price,
      mapTier: ctx.mapTier,
      generatorVersion: TOKEN_GENERATOR_VERSION,
      ext: emptyTokenExtensions(),
    });
  }
}
