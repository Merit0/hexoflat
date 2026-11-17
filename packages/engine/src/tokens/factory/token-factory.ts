import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { deriveStream } from '../../utils/random-seeded';
import { BASE_REALMS, itemTokenIdOf, tokenSourceIdSchema, type TBaseRealm } from '../token-keys';
import { emptyTokenExtensions, type ItemToken } from '../token-schema';
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
  type TokenResult,
  type TTokenStep,
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

export function tokenStreamLabel(id: string, step: TTokenStep): string {
  return `token:${id}:${step}`;
}

function baseRealmOf(realm: ERarityKind): TBaseRealm | null {
  return (BASE_REALMS as readonly ERarityKind[]).includes(realm) ? (realm as TBaseRealm) : null;
}

function contextRefusal(ctx: GenerationContext): TokenResult<never> | null {
  if (!tokenSourceIdSchema.safeParse(ctx.sourceId).success) {
    return refuseToken('BAD_SOURCE_ID', `source id "${ctx.sourceId}" is not <kind>:<key>`);
  }
  if (!Number.isSafeInteger(ctx.n) || ctx.n < 0) {
    return refuseToken('BAD_ITEM_INDEX', `item index ${ctx.n} is not a whole number from 0`);
  }
  if (baseRealmOf(ctx.realm) === null) {
    return refuseToken('GOD_EXECUTOR_NOT_BASE', `${ctx.realm} items are unique only`);
  }
  return null;
}

export class TokenFactory {
  constructor(private readonly parts: TokenFactoryParts) {}

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
}
