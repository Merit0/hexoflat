import { dimensionOfItemFamily } from '../../dimensions/dimensions';
import { decodedSourceId } from '../source-id';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { deriveStream } from '../../utils/random-seeded';
import {
  BASE_REALMS,
  itemTokenIdOf,
  tokenSourceIdSchema,
  mapTierSchema,
  type TBaseRealm,
} from '../token-keys';
import type { TypeRegistry, UniqueRegistry } from '../registries';
import { emptyTokenExtensions, type ItemToken } from '../token-schema';
import type { UniqueTokenDefinition } from '../unique-schema';
import type { IAttributeGenerator as IEquipmentAttributeGenerator } from '../equipment/generator/generator-contracts';
import { seededRandomStreams } from '../equipment/generator/attribute-streams';
import { resolveGenerationLevel } from '../equipment/generator/generation-level';
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
  type IUniqueSpriteResolver,
  type TokenOverrides,
  type TokenResult,
  type TTokenStep,
  type UniqueGenerationContext,
} from './token-generation';

export interface TokenFactoryParts {
  typePicker: ITypePicker;
  nameGenerator: INameGenerator;
  spriteResolver: ISpriteResolver;
  attributeGenerator: IEquipmentAttributeGenerator;
  skillGenerator: ISkillGenerator;
  priceGenerator: IPriceGenerator;
  descriptionBuilder: IDescriptionBuilder;
  validator: ITokenValidator;
}

export interface UniqueTokenParts {
  types: TypeRegistry;
  uniques: UniqueRegistry;
  spriteResolver: IUniqueSpriteResolver;
}

export function tokenStreamLabel(id: string, step: TTokenStep): string {
  return `token:${id}:${step}`;
}

function baseRealmOf(realm: ERarityKind): TBaseRealm | null {
  return (BASE_REALMS as readonly ERarityKind[]).includes(realm) ? (realm as TBaseRealm) : null;
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

function contextRefusal(ctx: GenerationContext): TokenResult<never> | null {
  const refusal = sourceRefusal(ctx);
  if (refusal) return refusal;
  if (baseRealmOf(ctx.realm) === null) {
    return refuseToken('ALIEN_NOT_BASE', `${ctx.realm} items are unique only`);
  }
  return null;
}

export class TokenFactory {
  constructor(
    private readonly parts: TokenFactoryParts,
    private readonly uniqueParts: UniqueTokenParts | null = null,
  ) {}

  createBase(ctx: GenerationContext, overrides: TokenOverrides = {}): TokenResult<ItemToken> {
    const refusal = contextRefusal(ctx);
    if (refusal) return refusal;
    const realm = baseRealmOf(ctx.realm) as TBaseRealm;
    const id = itemTokenIdOf(ctx.sourceId, ctx.n);
    const stream = (step: TTokenStep) => deriveStream(ctx.seed, tokenStreamLabel(id, step));
    const picked = this.parts.typePicker.pick(realm, ctx.type, stream('type'));
    if (!picked.ok) return picked;
    const type = picked.value;
    if (!type.group) return refuseToken('INVALID_TOKEN', `item type "${type.key}" has no group`);
    const attributes = overrides.attributes
      ? overrides.attributes.map((attribute) => ({ ...attribute }))
      : this.parts.attributeGenerator.generate({
          level: resolveGenerationLevel(null, ctx.mapTier),
          group: type.group,
          type,
          tokenId: id,
          rng: seededRandomStreams(ctx.seed),
        });
    const checked = this.parts.validator.validateAttributes({
      type,
      origin: 'base',
      mapTier: ctx.mapTier,
      attributes,
    });
    if (!checked.ok) return checked;
    const attributeCount = attributes.length;
    return this.parts.validator.validate({
      id,
      origin: 'base',
      type: type.key,
      rarity: realm,
      dimension: dimensionOfItemFamily(realm),
      name: this.parts.nameGenerator.generate({ type, attributeCount }, stream('name')),
      description: this.parts.descriptionBuilder.build({ type, realm, mapTier: ctx.mapTier }),
      attributes,
      skills: this.parts.skillGenerator.generate(type, stream('skills')),
      price:
        overrides.price ??
        this.parts.priceGenerator.generate(realm, attributeCount, stream('price')),
      sprite: this.parts.spriteResolver.resolve(type, realm, stream('sprite')),
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
    if (ctx.ownedUniques.includes(uniqueKey)) {
      return refuseToken('UNIQUE_ALREADY_OWNED', `the hero already owns unique "${uniqueKey}"`);
    }
    const definition = unique.uniques.get(uniqueKey);
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
    const attributes = definition.attributes.map((attribute) => ({ ...attribute }));
    const checked = this.parts.validator.validateAttributes({
      type,
      origin: 'unique',
      mapTier: ctx.mapTier,
      attributes,
    });
    if (!checked.ok) return checked;
    return this.parts.validator.validate({
      id,
      origin: 'unique',
      uniqueKey: definition.key,
      type: type.key,
      rarity: definition.rarity,
      dimension: definition.dimension,
      name: { ...definition.name },
      description: this.parts.descriptionBuilder.build({
        type,
        realm: definition.rarity,
        mapTier: ctx.mapTier,
        descriptionKey: definition.descriptionKey,
      }),
      attributes,
      skills: [...definition.skills],
      price: definition.price,
      sprite: unique.spriteResolver.resolveUnique(definition.key),
      mapTier: ctx.mapTier,
      generatorVersion: TOKEN_GENERATOR_VERSION,
      ext: emptyTokenExtensions(),
    });
  }
}
