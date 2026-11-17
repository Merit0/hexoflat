import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { deriveStream } from '../../utils/random-seeded';
import { BASE_REALMS, itemTokenIdOf, tokenSourceIdSchema, type TBaseRealm } from '../token-keys';
import type { TypeRegistry, UniqueRegistry } from '../registries';
import { emptyTokenExtensions, type ItemToken } from '../token-schema';
import type { UniqueTokenDefinition } from '../unique-schema';
import {
  refuseToken,
  TOKEN_GENERATOR_VERSION,
  type GenerationContext,
  type IAttributeGenerator,
  type IDescriptionBuilder,
  type INameGenerator,
  type IPriceGenerator,
  type ISkillGenerator,
  type ISpriteResolver,
  type ITokenValidator,
  type ITypePicker,
  type IUniqueSpriteResolver,
  type TokenResult,
  type TTokenStep,
  type UniqueGenerationContext,
} from './token-generation';

export interface TokenFactoryParts {
  typePicker: ITypePicker;
  nameGenerator: INameGenerator;
  spriteResolver: ISpriteResolver;
  attributeGenerator: IAttributeGenerator;
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

function sourceRefusal(ctx: { sourceId: string; n: number }): TokenResult<never> | null {
  if (!tokenSourceIdSchema.safeParse(ctx.sourceId).success) {
    return refuseToken('BAD_SOURCE_ID', `source id "${ctx.sourceId}" is not <kind>:<key>`);
  }
  if (!Number.isSafeInteger(ctx.n) || ctx.n < 0) {
    return refuseToken('BAD_ITEM_INDEX', `item index ${ctx.n} is not a whole number from 0`);
  }
  return null;
}

function contextRefusal(ctx: GenerationContext): TokenResult<never> | null {
  const refusal = sourceRefusal(ctx);
  if (refusal) return refusal;
  if (baseRealmOf(ctx.realm) === null) {
    return refuseToken('GOD_EXECUTOR_NOT_BASE', `${ctx.realm} items are unique only`);
  }
  return null;
}

export class TokenFactory {
  constructor(
    private readonly parts: TokenFactoryParts,
    private readonly uniqueParts: UniqueTokenParts | null = null,
  ) {}

  createBase(ctx: GenerationContext): TokenResult<ItemToken> {
    const refusal = contextRefusal(ctx);
    if (refusal) return refusal;
    const realm = baseRealmOf(ctx.realm) as TBaseRealm;
    const id = itemTokenIdOf(ctx.sourceId, ctx.n);
    const stream = (step: TTokenStep) => deriveStream(ctx.seed, tokenStreamLabel(id, step));
    const picked = this.parts.typePicker.pick(realm, ctx.type, stream('type'));
    if (!picked.ok) return picked;
    const type = picked.value;
    const attributes = this.parts.attributeGenerator.generate(
      type,
      ctx.mapTier,
      stream('attributes'),
    );
    return this.parts.validator.validate({
      id,
      origin: 'base',
      type: type.key,
      rarity: realm,
      name: this.parts.nameGenerator.generate(type, realm, stream('name')),
      description: this.parts.descriptionBuilder.build({
        type,
        realm,
        mapTier: ctx.mapTier,
        attributes,
      }),
      attributes,
      skills: this.parts.skillGenerator.generate(type, stream('skills')),
      price: this.parts.priceGenerator.generate(realm, stream('price')),
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
    const rolled = definition.rolled?.attributes
      ? this.parts.attributeGenerator.generate(
          type,
          ctx.mapTier,
          deriveStream(ctx.seed, tokenStreamLabel(id, 'attributes')),
          {
            maxCount: definition.rolled.attributes,
            exclude: definition.attributes.map((attribute) => attribute.key),
          },
        )
      : [];
    const attributes = [...definition.attributes.map((attribute) => ({ ...attribute })), ...rolled];
    return this.parts.validator.validate({
      id,
      origin: 'unique',
      uniqueKey: definition.key,
      type: type.key,
      rarity: definition.rarity,
      name: { ...definition.name },
      description: this.parts.descriptionBuilder.build({
        type,
        realm: definition.rarity,
        mapTier: ctx.mapTier,
        attributes,
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
