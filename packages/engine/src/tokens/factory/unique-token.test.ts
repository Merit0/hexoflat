import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { createTokenRegistries, TOKEN_CONTENT } from '../../content/token-content';
import { TOKEN_UNIQUES } from '../../content/token-uniques.content';
import { lightTone } from '../light-tone';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { emptyTokenExtensions, itemTokenSchema, type ItemToken } from '../token-schema';
import type { UniqueTokenDefinition } from '../unique-schema';
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

function definition(key: string): UniqueTokenDefinition {
  const found = TOKEN_UNIQUES.find((unique) => unique.key === key);
  if (!found) throw new Error(`no unique ${key}`);
  return found;
}

const RICH_CONTENT = {
  ...TOKEN_CONTENT,
  attributes: [
    ...TOKEN_CONTENT.attributes,
    { key: 'ward', valueByTier: { 1: 3, 2: 4, 3: 5, 4: 6 }, weight: 1, implemented: true },
    { key: 'grit', valueByTier: { 1: 1, 2: 1, 3: 2, 4: 2 }, weight: 1, implemented: true },
  ],
};
const ROLLING: UniqueTokenDefinition = {
  ...definition('lantern-eater'),
  key: 'rolling-test',
  attributes: [{ key: 'heart', value: 1 }],
  rolled: { attributes: 2 },
};
const richFactory = createTokenFactory(RICH_CONTENT, SPRITE_MANIFEST, [...TOKEN_UNIQUES, ROLLING]);
const { attributes: richAttributes } = createTokenRegistries(RICH_CONTENT);
const { attributes: defaultAttributes } = createTokenRegistries();

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
        expect(token.origin).toBe('unique');
        expect(token.uniqueKey).toBe(unique.key);
        expect(token.type).toBe(unique.type);
        expect(token.rarity).toBe(unique.rarity);
        expect(token.name).toEqual(unique.name);
        expect(token.skills).toEqual(unique.skills);
        expect(token.price).toBe(unique.price);
        expect(token.attributes.slice(0, unique.attributes.length)).toEqual(unique.attributes);
        expect(token.description[0]).toEqual({ key: unique.descriptionKey, params: {} });
        expect(token.generatorVersion).toBe(TOKEN_GENERATOR_VERSION);
        expect(token.ext).toEqual(emptyTokenExtensions());
        expect(lightTone(token.origin, token.rarity)).toBe(
          unique.rarity === ERarityKind.GOD_EXECUTOR
            ? 'god-executor-unique'
            : `${unique.rarity}-unique`,
        );
      }
    });

    it('rolls exactly the rolled count, fewer only from an empty pool, never a fixed key', () => {
      const fixedKeys = unique.attributes.map((attribute) => attribute.key);
      for (const token of tokens) {
        const rolled = token.attributes.slice(unique.attributes.length);
        const pool = defaultAttributes
          .generatableFor(unique.type)
          .filter((rule) => !fixedKeys.includes(rule.key));
        expect(rolled.length).toBe(Math.min(unique.rolled?.attributes ?? 0, pool.length));
        expect(new Set(rolled.map((attribute) => attribute.key)).size).toBe(rolled.length);
        for (const attribute of rolled) {
          expect(fixedKeys).not.toContain(attribute.key);
          expect(attribute.value).toBe(
            richAttributes.get(attribute.key).valueByTier[token.mapTier],
          );
        }
      }
    });

    it('uses the placeholder while the sprite unique-<key> is not in the manifest', () => {
      for (const token of tokens) expect(token.sprite).toBe('_placeholder');
    });
  },
);

describe('TG-11: createUnique with a rolled part', () => {
  const tokens = SEEDS.map((seed) =>
    valueOf(richFactory.createUnique('rolling-test', uniqueContext(seed))),
  );

  it('adds exactly 2 implemented attributes at the tier value, never the fixed heart', () => {
    const counts = new Set<number>();
    for (const token of tokens) {
      expect(itemTokenSchema.safeParse(token).success).toBe(true);
      expect(token.attributes[0]).toEqual({ key: 'heart', value: 1 });
      const rolled = token.attributes.slice(1);
      counts.add(rolled.length);
      expect(new Set(rolled.map((attribute) => attribute.key)).size).toBe(rolled.length);
      for (const attribute of rolled) {
        const rule = richAttributes.get(attribute.key);
        expect(attribute.key).not.toBe('heart');
        expect(rule.implemented).toBe(true);
        expect(attribute.value).toBe(rule.valueByTier[token.mapTier]);
      }
    }
    expect(counts).toEqual(new Set([2]));
  });

  it('gives a deeply equal token for the same seed and context', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(richFactory.createUnique('rolling-test', uniqueContext(seed))).toEqual({
        ok: true,
        value: tokens[seed - 1],
      });
    }
  });

  it('takes the unique sprite from the manifest when it is there', () => {
    const manifest = {
      ...SPRITE_MANIFEST,
      entries: [
        ...SPRITE_MANIFEST.entries,
        {
          key: 'unique-lantern-eater',
          origin: 'unique' as const,
          realm: null,
          type: null,
          path: '/hex-assets/items/unique/unique-lantern-eater.png',
        },
      ],
    };
    const factory = createTokenFactory(TOKEN_CONTENT, manifest);
    const token = valueOf(factory.createUnique('lantern-eater', uniqueContext(1)));
    expect(token.sprite).toBe('unique-lantern-eater');
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
