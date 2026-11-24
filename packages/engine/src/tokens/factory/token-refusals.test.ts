import { describe, expect, it } from 'vitest';
import { AttributeRegistry } from '../registries';
import { ETokenType } from '../../abstraction/hexobject-abstraction';
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
import { BaseTypePicker } from './type-picker';
import { AdjectiveNameGenerator } from './name-generator';
import { ManifestSpriteResolver } from './sprite-resolver';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { createEquipmentAttributeGenerator } from '../equipment/generator/create-equipment-attribute-generator';
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
      'a type not allowed in the tokenType',
      { type: 'hammer', tokenType: ETokenType.GLOOM },
      'TYPE_NOT_IN_REALM',
      sparkOnly,
    ],
    ['the alien tokenType', { tokenType: ETokenType.ALIEN }, 'ALIEN_NOT_BASE'],
    ['a source id without a kind', { sourceId: 'cave-chest-4-7' }, 'BAD_SOURCE_ID'],
    ['an invalid source kind', { sourceId: 'Boss:king' }, 'BAD_SOURCE_ID'],
    ['a source key with capitals', { sourceId: 'chest:Cave' }, 'BAD_SOURCE_ID'],
    ['a negative item index', { n: -1 }, 'BAD_ITEM_INDEX'],
  ])('refuses %s', (_label, overrides, code, factory) => {
    expect(refusalOf(contextFor(3, overrides), factory)).toBe(code);
  });

  it('refuses a tokenType that allows no type', () => {
    const noIdol = createTokenFactory(
      {
        ...TOKEN_CONTENT,
        baseItems: extendedContent().baseItems.filter((item) => item.type === 'hammer'),
        types: extendedContent().types.filter((type) => type.key === 'hammer'),
      },
      extendedManifest(),
      [],
    );
    expect(refusalOf(contextFor(3, { tokenType: ETokenType.IDOL }), noIdol)).toBe(
      'NO_TYPE_IN_REALM',
    );
  });

  it('returns the validator refusal for a token that fails the schema', () => {
    const { types, baseItems } = createTokenRegistries();
    const failing: ITokenValidator = {
      validateAttributes: () => ({ ok: true, value: true }),
      validate: () => ({ ok: false, refusal: { code: 'INVALID_TOKEN', message: 'test' } }),
    };
    const factory = new TokenFactory({
      baseItems,
      typePicker: new BaseTypePicker(types),
      nameGenerator: new AdjectiveNameGenerator(TOKEN_CONTENT.adjectives),
      spriteResolver: new ManifestSpriteResolver(new ManifestSpriteRegistry(SPRITE_MANIFEST)),
      attributeGenerator: createEquipmentAttributeGenerator(
        new AttributeRegistry(TOKEN_CONTENT.attributes),
        TOKEN_CONTENT.profiles,
      ),
      skillGenerator: new EmptySkillGenerator(),
      priceGenerator: new RangePriceGenerator(TOKEN_CONTENT.priceRanges),
      descriptionBuilder: new SpecSheetDescriptionBuilder(),
      validator: failing,
    });
    expect(refusalOf(contextFor(3), factory)).toBe('INVALID_TOKEN');
  });

  it('LG5f: createBase and createUnique refuse a source id that contains the seed, raw or with other separators', () => {
    const cases: [string, string][] = [
      [
        '0f1e2d3c4b5a69788796a5b4c3d2e1f0.run-7',
        'quest:0f1e2d3c4b5a69788796a5b4c3d2e1f0.run-7.3-4',
      ],
      [
        '0f1e2d3c4b5a69788796a5b4c3d2e1f0:Run:7',
        'quest:0f1e2d3c4b5a69788796a5b4c3d2e1f0-run-7.3-4',
      ],
    ];
    for (const [seed, sourceId] of cases) {
      expect(refusalOf(contextFor(3, { seed, sourceId }))).toBe('SOURCE_ID_CONTAINS_SEED');
      const unique = defaultFactory.createUnique('last-verdict', {
        seed,
        sourceId,
        n: 0,
        mapTier: 1,
        ownedUniques: [],
      });
      expect(unique.ok ? null : unique.refusal.code).toBe('SOURCE_ID_CONTAINS_SEED');
    }
    expect(
      refusalOf(contextFor(3, { seed: cases[1][0], sourceId: 'quest:4be1c2d3a4f5.3-4' })),
    ).toBeNull();
  });

  it('accepts every source kind', () => {
    for (const kind of ['chest', 'grave', 'quest', 'shop', 'upcast', 'dev', 'test']) {
      expect(refusalOf(contextFor(3, { sourceId: `${kind}:map-1.4_7` }))).toBeNull();
    }
  });
});
