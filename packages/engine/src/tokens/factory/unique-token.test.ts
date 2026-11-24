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
    ownedUniques: [],
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

    it('copies the fixed fields of the definition', () => {
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

    it('EA-5: keeps exactly the attributes of the definition', () => {
      for (const token of tokens) expect(token.attributes).toEqual(unique.attributes);
    });

    it('stores no attribute line in the description', () => {
      for (const token of tokens) {
        expect(token.description.some((line) => line.key.startsWith('content.tokens.attr.'))).toBe(
          false,
        );
      }
    });

    it('uses the placeholder while the sprite <key> is not in the manifest', () => {
      for (const token of tokens) expect(token.sprite).toBe('_placeholder');
    });
  },
);

describe('EA-5: createUnique never calls the attribute generator', () => {
  it('leaves the generator untouched and copies the definition attributes', () => {
    const generate = vi.fn(() => [{ key: 'heart', value: 1 }]);
    const factory = createTokenFactory(TOKEN_CONTENT, SPRITE_MANIFEST, TOKEN_UNIQUES, {
      attributeGenerator: { generate },
    });
    for (const unique of TOKEN_UNIQUES) {
      for (const seed of SEEDS.slice(0, 50)) {
        const token = valueOf(factory.createUnique(unique.key, uniqueContext(seed)));
        expect(token.attributes).toEqual(unique.attributes);
      }
    }
    expect(generate).not.toHaveBeenCalled();
    factory.createBase({
      seed: '1',
      sourceId: 'test:spy',
      n: 0,
      tokenType: ETokenType.IDOL,
      mapTier: 1,
      type: 'shield',
    });
    expect(generate).toHaveBeenCalledTimes(1);
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

  it('takes the unique sprite from the manifest when it is there', () => {
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
    expect(token.sprite).toBe('lantern-eater');
  });
});

describe('createUnique refusals', () => {
  it('refuses an unknown unique key', () => {
    expect(refusalOf(defaultFactory.createUnique('dragon-crown', uniqueContext(1)))).toBe(
      'UNKNOWN_UNIQUE',
    );
  });

  it('TG-11: refuses a unique the hero already owns', () => {
    const ctx = uniqueContext(1, { ownedUniques: ['lantern-eater'] });
    expect(refusalOf(defaultFactory.createUnique('lantern-eater', ctx))).toBe(
      'UNIQUE_ALREADY_OWNED',
    );
    expect(refusalOf(defaultFactory.createUnique('last-verdict', ctx))).toBeNull();
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
    const result = defaultFactory.createUnique(
      'lantern-eater',
      uniqueContext(1, { ownedUniques: ['lantern-eater'] }),
    );
    expect(result.ok).toBe(false);
    expect('value' in result).toBe(false);
  });
});
