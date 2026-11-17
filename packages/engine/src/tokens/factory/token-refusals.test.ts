import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { createTokenFactory } from './create-token-factory';
import {
  contextFor,
  defaultFactory,
  extendedContent,
  extendedManifest,
} from './factory-test-setup';
import { TokenFactory } from './token-factory';
import type { GenerationContext, ITokenValidator } from './token-generation';
import { TOKEN_CONTENT } from '../../content/token-content';
import { createTokenRegistries } from '../../content/token-content';
import { RealmTypePicker } from './type-picker';
import { WordPoolNameGenerator } from './name-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { WeightedAttributeGenerator } from './attribute-generator';
import { EmptySkillGenerator } from './skill-generator';
import { RangePriceGenerator } from './price-generator';
import { SpecSheetDescriptionBuilder } from './description-builder';

function refusalOf(ctx: GenerationContext, factory: TokenFactory = defaultFactory) {
  const result = factory.createBase(ctx);
  return result.ok ? null : result.refusal.code;
}

const sparkOnly = createTokenFactory(extendedContent(), extendedManifest());

describe('TokenFactory.createBase refusals', () => {
  it.each<[string, Partial<GenerationContext>, string, TokenFactory?]>([
    ['an unknown type', { type: 'dragon-egg' }, 'UNKNOWN_TYPE'],
    [
      'a type not allowed in the realm',
      { type: 'hammer', realm: ERarityKind.GLOOM },
      'TYPE_NOT_IN_REALM',
      sparkOnly,
    ],
    ['the god-executor realm', { realm: ERarityKind.GOD_EXECUTOR }, 'GOD_EXECUTOR_NOT_BASE'],
    ['a source id without a kind', { sourceId: 'cave-chest-4-7' }, 'BAD_SOURCE_ID'],
    ['a source id of an unknown kind', { sourceId: 'boss:king' }, 'BAD_SOURCE_ID'],
    ['a source key with capitals', { sourceId: 'chest:Cave' }, 'BAD_SOURCE_ID'],
    ['a negative item index', { n: -1 }, 'BAD_ITEM_INDEX'],
  ])('refuses %s', (_label, overrides, code, factory) => {
    expect(refusalOf(contextFor(3, overrides), factory)).toBe(code);
  });

  it('refuses a realm that allows no type', () => {
    const noIdol = createTokenFactory(
      { ...TOKEN_CONTENT, types: extendedContent().types.filter((type) => type.key === 'hammer') },
      extendedManifest(),
    );
    expect(refusalOf(contextFor(3, { realm: ERarityKind.IDOL }), noIdol)).toBe('NO_TYPE_IN_REALM');
  });

  it('returns the validator refusal for a token that fails the schema', () => {
    const { types, attributes, words } = createTokenRegistries();
    const failing: ITokenValidator = {
      validate: () => ({ ok: false, refusal: { code: 'INVALID_TOKEN', message: 'test' } }),
    };
    const factory = new TokenFactory({
      typePicker: new RealmTypePicker(types),
      nameGenerator: new WordPoolNameGenerator(words),
      spriteResolver: new ManifestSpriteResolver(new ManifestSpriteRegistry(SPRITE_MANIFEST)),
      attributeGenerator: new WeightedAttributeGenerator(attributes),
      skillGenerator: new EmptySkillGenerator(),
      priceGenerator: new RangePriceGenerator(TOKEN_CONTENT.priceRanges),
      descriptionBuilder: new SpecSheetDescriptionBuilder(attributes),
      validator: failing,
    });
    expect(refusalOf(contextFor(3), factory)).toBe('INVALID_TOKEN');
  });

  it('accepts every source kind', () => {
    for (const kind of ['chest', 'grave', 'quest', 'shop', 'upcast', 'dev', 'test']) {
      expect(refusalOf(contextFor(3, { sourceId: `${kind}:map-1.4_7` }))).toBeNull();
    }
  });
});
