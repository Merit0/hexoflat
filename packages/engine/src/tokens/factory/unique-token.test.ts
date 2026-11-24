import { describe, expect, it, vi } from 'vitest';
import { ETokenType } from '../../abstraction/hexobject-abstraction';
import { TOKEN_CONTENT } from '../../content/token-content';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { lightTone } from '../light-tone';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { emptyTokenExtensions, itemTokenSchema, type ItemToken } from '../token-schema';
import { createTokenFactory } from './create-token-factory';
import { defaultFactory } from './factory-test-setup';
import {
  TOKEN_GENERATOR_VERSION,
  type TokenResult,
  type UniqueGenerationContext,
} from './token-generation';

const SEEDS = Array.from({ length: 500 }, (_, index) => index + 1);

function uniqueContext(
  seed: number,
  overrides: Partial<UniqueGenerationContext> = {},
): UniqueGenerationContext {
  return {
    seed: String(seed),
    sourceId: 'test:unique',
    n: seed,
    mapTier: seed % 2 === 0 ? 3 : 4,
    ...overrides,
  };
}

function valueOf(result: TokenResult<ItemToken>): ItemToken {
  if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

function refusalOf(result: TokenResult<ItemToken>): string | null {
  return result.ok ? null : result.refusal.code;
}

describe.each(TOKEN_UNIQUES.map((unique) => [unique.key, unique] as const))(
  'TG-11: createUnique(%s) over seeds 1-500',
  (key, unique) => {
    const tokens = SEEDS.map((seed) =>
      valueOf(defaultFactory.createUnique(key, uniqueContext(seed))),
    );

    it('passes the token schema', () => {
      for (const token of tokens) expect(itemTokenSchema.safeParse(token).success).toBe(true);
    });

    it('copies the fixed fields of the template', () => {
      for (const token of tokens) {
        expect(token.tier).toBe('unique');
        expect(token.uniqueKey).toBe(unique.key);
        expect(token.type).toBe(unique.type);
        expect(token.tokenType).toBe(unique.tokenType);
        expect(token.name).toEqual(unique.name);
        expect(token.skills).toEqual(unique.skills);
        expect(token.price).toBe(unique.price);
        expect(token.description[0]).toEqual({ key: unique.descriptionKey, params: {} });
        expect(token.generatorVersion).toBe(TOKEN_GENERATOR_VERSION);
        expect(token.ext).toEqual(emptyTokenExtensions());
        expect(lightTone(token.tier, token.tokenType)).toBe(
          unique.tokenType === ETokenType.ALIEN ? 'alien-unique' : `${unique.tokenType}-unique`,
        );
      }
    });

    it('stores no attribute line in the description', () => {
      for (const token of tokens) {
        expect(token.description.some((line) => line.key.startsWith('content.tokens.attr.'))).toBe(
          false,
        );
      }
    });

    it('stores no sprite', () => {
      for (const token of tokens) expect(token).not.toHaveProperty('sprite');
    });
  },
);

describe('createUnique layers', () => {
  it('rolls the generated layer with the unique generator and never with the base one', () => {
    const base = vi.fn(() => []);
    const unique = vi.fn(() => [{ key: 'will', value: 2 }]);
    const factory = createTokenFactory(TOKEN_CONTENT, SPRITE_MANIFEST, TOKEN_UNIQUES, {
      attributeGenerator: { generate: base },
      uniqueAttributeGenerator: { generate: unique },
    });
    for (const definition of TOKEN_UNIQUES) {
      const token = valueOf(factory.createUnique(definition.key, uniqueContext(2)));
      expect(token.attributes.map((attribute) => attribute.key)).toEqual([
        'will',
        ...definition.authoredAttributes.map((entry) => entry.attribute),
      ]);
    }
    expect(base).not.toHaveBeenCalled();
    expect(unique).toHaveBeenCalledTimes(TOKEN_UNIQUES.length);
    factory.createBase({
      seed: '1',
      sourceId: 'test:spy',
      n: 0,
      tokenType: ETokenType.IDOL,
      mapTier: 1,
      type: 'shield',
    });
    expect(base).toHaveBeenCalledTimes(1);
    expect(unique).toHaveBeenCalledTimes(TOKEN_UNIQUES.length);
  });

  it('refuses a generated layer that repeats an authored key or leaves its bounds', () => {
    const create = (attributes: { key: string; value: number }[]) =>
      createTokenFactory(TOKEN_CONTENT, SPRITE_MANIFEST, TOKEN_UNIQUES, {
        uniqueAttributeGenerator: { generate: () => attributes },
      }).createUnique('lantern-eater', uniqueContext(2));
    expect(create([]).ok).toBe(true);
    expect(refusalOf(create([{ key: 'heart', value: 1 }]))).toBe('INVALID_TOKEN');
    expect(refusalOf(create([{ key: 'will', value: 46 }]))).toBe('INVALID_TOKEN');
    expect(refusalOf(create([{ key: 'shield', value: 1 }]))).toBe('INVALID_TOKEN');
    expect(
      refusalOf(
        create([
          { key: 'will', value: 2 },
          { key: 'trophy', value: 2 },
          { key: 'crit-chance', value: 4 },
        ]),
      ),
    ).toBe('INVALID_TOKEN');
  });

  it('gives a deeply equal token for the same seed and context', () => {
    for (const unique of TOKEN_UNIQUES) {
      for (const seed of SEEDS.slice(0, 50)) {
        expect(defaultFactory.createUnique(unique.key, uniqueContext(seed))).toEqual(
          defaultFactory.createUnique(unique.key, uniqueContext(seed)),
        );
      }
    }
  });

  it('stores no sprite even when the file is in the manifest', () => {
    const manifest = {
      ...SPRITE_MANIFEST,
      entries: [
        ...SPRITE_MANIFEST.entries,
        {
          key: 'lantern-eater',
          tier: 'unique' as const,
          tokenType: null,
          type: null,
          path: '/hex-assets/items/unique/lantern-eater.png',
        },
      ],
    };
    const factory = createTokenFactory(TOKEN_CONTENT, manifest);
    const token = valueOf(factory.createUnique('lantern-eater', uniqueContext(1)));
    expect(token).not.toHaveProperty('sprite');
  });
});

describe('createUnique refusals', () => {
  it('refuses an unknown unique key', () => {
    expect(refusalOf(defaultFactory.createUnique('dragon-crown', uniqueContext(1)))).toBe(
      'UNKNOWN_UNIQUE',
    );
  });

  it('refuses a bad source id and a bad item index', () => {
    expect(
      refusalOf(defaultFactory.createUnique('last-verdict', uniqueContext(1, { sourceId: 'x' }))),
    ).toBe('BAD_SOURCE_ID');
    expect(
      refusalOf(defaultFactory.createUnique('last-verdict', uniqueContext(1, { n: -1 }))),
    ).toBe('BAD_ITEM_INDEX');
  });

  it('never falls back to a base token', () => {
    const result = defaultFactory.createUnique('dragon-crown', uniqueContext(1));
    expect(result.ok).toBe(false);
    expect('value' in result).toBe(false);
  });
});
