import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../../abstraction/hexobject-abstraction';
import { createTokenRegistries, TOKEN_CONTENT } from '../../content/token-content';
import { lightTone } from '../light-tone';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { itemTokenSchema, emptyTokenExtensions, type ItemToken } from '../token-schema';
import { createTokenFactory } from './create-token-factory';
import { contextFor, defaultFactory, mixedContexts } from './factory-test-setup';
import { TOKEN_GENERATOR_VERSION, type GenerationContext } from './token-generation';

const { types, attributes } = createTokenRegistries();
const TYPE_KEYS = [undefined, ...types.all().map((type) => type.key)];
const MIXED = mixedContexts(500, TYPE_KEYS);

function created(ctx: GenerationContext): ItemToken {
  const result = defaultFactory.createBase(ctx);
  if (!result.ok) throw new Error(`${result.refusal.code}: ${result.refusal.message}`);
  return result.value;
}

const TOKENS = MIXED.map((ctx) => ({ ctx, token: created(ctx) }));

describe('TokenFactory.createBase', () => {
  it('TG-1: makes 500 mixed realm x tier x type tokens that pass the schema', () => {
    expect(TOKENS).toHaveLength(500);
    for (const { token } of TOKENS) expect(itemTokenSchema.safeParse(token).success).toBe(true);
    const realms = new Set(TOKENS.map(({ token }) => token.rarity));
    const tiers = new Set(TOKENS.map(({ token }) => token.mapTier));
    const kinds = new Set(TOKENS.map(({ token }) => token.type));
    expect(realms.size).toBe(3);
    expect(tiers.size).toBe(4);
    expect(kinds.size).toBe(types.all().length);
  });

  it('TG-1: keeps the requested type and the context fields', () => {
    for (const { ctx, token } of TOKENS) {
      if (ctx.type) expect(token.type).toBe(ctx.type);
      expect(token.rarity).toBe(ctx.realm);
      expect(token.mapTier).toBe(ctx.mapTier);
      expect(token.id).toBe(`${ctx.sourceId}:${ctx.n}`);
    }
  });

  it('TG-2: gives 0-2 implemented attributes without repeats at the tier value', () => {
    const counts = new Set<number>();
    for (const { token } of TOKENS) {
      const keys = token.attributes.map((attribute) => attribute.key);
      counts.add(keys.length);
      expect(keys.length).toBeLessThanOrEqual(2);
      expect(new Set(keys).size).toBe(keys.length);
      for (const attribute of token.attributes) {
        const definition = attributes.get(attribute.key);
        expect(definition.implemented).toBe(true);
        expect(attributes.generatableFor(token.type)).toContain(definition);
        expect(attribute.value).toBe(definition.valueByTier[token.mapTier]);
      }
    }
    expect(counts).toEqual(new Set([0, 1]));
  });

  it('TG-3: takes the sprite from the manifest of its type or the placeholder', () => {
    const sprites = new ManifestSpriteRegistry(SPRITE_MANIFEST);
    for (const { token } of TOKENS) {
      const allowed = sprites.spritesFor('base', token.rarity, token.type).map((ref) => ref.key);
      expect(allowed).toContain(token.sprite);
      expect(lightTone(token.origin, token.rarity)).toBe(`${token.rarity}-base`);
    }
  });

  it('TG-3: uses the placeholder for a type without sprites', () => {
    const empty = createTokenFactory(TOKEN_CONTENT, { ...SPRITE_MANIFEST, entries: [] });
    const result = empty.createBase(contextFor(1, { type: 'sword' }));
    expect(result.ok && result.value.sprite).toBe('_placeholder');
  });
});

describe('TokenFactory.createBase prices, determinism and text', () => {
  it('TG-5: prices inside the realm range, no skills, default extensions', () => {
    for (const { token } of TOKENS) {
      const [min, max] = TOKEN_CONTENT.priceRanges[token.rarity as ERarityKind.IDOL];
      expect(Number.isInteger(token.price)).toBe(true);
      expect(token.price).toBeGreaterThanOrEqual(min);
      expect(token.price).toBeLessThanOrEqual(max);
      expect(token.skills).toEqual([]);
      expect(token.ext).toEqual(emptyTokenExtensions());
      expect(token.origin).toBe('base');
      expect(token.uniqueKey).toBeUndefined();
      expect(token.generatorVersion).toBe(TOKEN_GENERATOR_VERSION);
    }
  });

  it('TG-6: gives a deeply equal token for the same seed and context', () => {
    const fresh = createTokenFactory();
    for (const { ctx, token } of TOKENS.slice(0, 100)) {
      expect(fresh.createBase(ctx)).toEqual({ ok: true, value: token });
      expect(defaultFactory.createBase({ ...ctx })).toEqual({ ok: true, value: token });
    }
  });

  it('TG-6: gives another token for another seed or item index', () => {
    const base = created(contextFor(7, { type: 'sword' }));
    const otherSeed = created(contextFor(7, { type: 'sword', seed: 'other' }));
    const otherIndex = created(contextFor(7, { type: 'sword', n: 8 }));
    expect(otherSeed).not.toEqual(base);
    expect(otherIndex.id).toBe('test:factory:8');
    expect(otherIndex).not.toEqual(base);
  });

  it('names tools by their type and never pairs words of one theme', () => {
    const { words } = createTokenRegistries();
    const themeOf = new Map(
      [...TOKEN_CONTENT.words.prefixes, ...TOKEN_CONTENT.words.suffixes].map((word) => [
        word.key,
        word.theme,
      ]),
    );
    for (const { token } of TOKENS) {
      const type = types.get(token.type);
      if (type.tool) {
        expect(token.name).toEqual({ kind: 'noun', noun: token.type });
        continue;
      }
      if (token.name.kind !== 'generated') throw new Error('expected a generated name');
      const { prefix, suffix } = token.name;
      expect(prefix ?? suffix).toBeDefined();
      if (prefix && suffix && themeOf.get(prefix))
        expect(themeOf.get(suffix)).not.toBe(themeOf.get(prefix));
      if (prefix) expect(words.prefixes(token.rarity).map((word) => word.key)).toContain(prefix);
      if (suffix) expect(words.suffixes(token.rarity).map((word) => word.key)).toContain(suffix);
    }
  });

  it('builds the spec sheet description from the token data', () => {
    const axe = created(contextFor(2, { type: 'axe', realm: ERarityKind.GLOOM, mapTier: 3 }));
    expect(axe.description[0]).toEqual({
      key: 'content.tokens.line.kind',
      params: { type: 'content.tokens.noun.axe', realm: 'content.tokens.realm.gloom' },
    });
    expect(axe.description[1]).toEqual({
      key: 'content.tokens.line.strike',
      params: { strike: 0.5 },
    });
    expect(axe.description.at(-2)).toEqual({ key: 'content.tokens.tool.cut', params: {} });
    expect(axe.description.at(-1)).toEqual({
      key: 'content.tokens.line.tier',
      params: { tier: 3 },
    });
    for (const { token } of TOKENS) {
      const hearts = token.attributes.find((attribute) => attribute.key === 'heart');
      const line = token.description.find((entry) => entry.key === 'content.tokens.attr.heart');
      expect(line?.params.value).toBe(hearts ? hearts.value / 2 : undefined);
    }
  });

  it('matches the golden tokens of 20 fixed seeds', () => {
    const golden = Array.from({ length: 20 }, (_, index) =>
      created(contextFor(1000 + index, { sourceId: 'test:golden', n: index })),
    );
    expect(golden).toMatchSnapshot();
  });
});
