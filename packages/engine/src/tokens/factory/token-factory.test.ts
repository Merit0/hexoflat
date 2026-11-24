import { describe, expect, it } from 'vitest';
import { ETokenType } from '../../abstraction/hexobject-abstraction';
import { createTokenRegistries, TOKEN_CONTENT } from '../../content/token-content';
import { lightTone } from '../light-tone';
import { ManifestSpriteRegistry } from '../sprite-registry';
import { SPRITE_MANIFEST } from '../sprite-manifest';
import { itemTokenSchema, emptyTokenExtensions, type ItemToken } from '../token-schema';
import { createTokenFactory } from './create-token-factory';
import { contextFor, defaultFactory, mixedContexts } from './factory-test-setup';
import { priceBandOf } from './price-generator';
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
  it('TG-1: makes 500 mixed tokenType x tier x type tokens that pass the schema', () => {
    expect(TOKENS).toHaveLength(500);
    for (const { token } of TOKENS) expect(itemTokenSchema.safeParse(token).success).toBe(true);
    const tokenTypes = new Set(TOKENS.map(({ token }) => token.tokenType));
    const tiers = new Set(TOKENS.map(({ token }) => token.mapTier));
    const kinds = new Set(TOKENS.map(({ token }) => token.type));
    expect(tokenTypes.size).toBe(3);
    expect(tiers.size).toBe(4);
    expect(kinds.size).toBe(types.all().length);
  });

  it('TG-1: keeps the requested type and the context fields', () => {
    for (const { ctx, token } of TOKENS) {
      if (ctx.type) expect(token.type).toBe(ctx.type);
      expect(token.tokenType).toBe(ctx.tokenType);
      expect(token.mapTier).toBe(ctx.mapTier);
      expect(token.id).toBe(`${ctx.sourceId}:${ctx.n}`);
    }
  });

  it('TG-2: gives at most maxCount implemented attributes of the type group inside the tier range', () => {
    const counts = new Set<number>();
    for (const { token } of TOKENS) {
      const keys = token.attributes.map((attribute) => attribute.key);
      const profile = TOKEN_CONTENT.profiles[`tier-${token.mapTier}`];
      const type = types.get(token.type);
      counts.add(keys.length);
      expect(keys.length).toBeLessThanOrEqual(profile.maxCount);
      expect(new Set(keys).size).toBe(keys.length);
      for (const attribute of token.attributes) {
        const definition = attributes.get(attribute.key);
        const range = profile.attributes[attribute.key];
        expect(definition.implemented).toBe(true);
        expect(definition.groups).toContain(type.group);
        expect(attribute.value).toBeGreaterThanOrEqual(range.min);
        expect(attribute.value).toBeLessThanOrEqual(range.max);
      }
    }
    expect(counts).toEqual(new Set([0, 1, 2]));
  });

  it('TG-2: gives the sword no heart, because heart is not a weapon attribute', () => {
    const swords = TOKENS.filter(({ token }) => token.type === 'sword');
    expect(swords.length).toBeGreaterThan(0);
    for (const { token } of swords)
      expect(token.attributes.some((attribute) => attribute.key === 'heart')).toBe(false);
  });

  it('TG-3: stores an own sprite of its tokenType and type, else null', () => {
    const sprites = new ManifestSpriteRegistry(SPRITE_MANIFEST);
    for (const { token } of TOKENS) {
      const { step, refs } = sprites.resolveBase(token.tokenType, token.type);
      if (step === 'own') expect(refs.map((ref) => ref.key)).toContain(token.sprite);
      else expect(token.sprite).toBeNull();
      expect(lightTone(token.tier, token.tokenType)).toBe(`${token.tokenType}-base`);
    }
  });

  it('TG-3: stores null for a type without sprites', () => {
    const empty = createTokenFactory(TOKEN_CONTENT, { ...SPRITE_MANIFEST, entries: [] });
    const result = empty.createBase(contextFor(1, { type: 'sword' }));
    expect(result.ok && result.value.sprite).toBeNull();
  });
});

describe('TokenFactory.createBase prices, determinism and text', () => {
  it('TG-5: prices inside the third of the tokenType range, no skills, default extensions', () => {
    for (const { token } of TOKENS) {
      const [min, max] = priceBandOf(
        TOKEN_CONTENT.priceRanges[token.tokenType as ETokenType.IDOL],
        token.attributes.length,
      );
      expect(Number.isInteger(token.price)).toBe(true);
      expect(token.price).toBeGreaterThanOrEqual(min);
      expect(token.price).toBeLessThanOrEqual(max);
      expect(token.skills).toEqual([]);
      expect(token.ext).toEqual(emptyTokenExtensions());
      expect(token.tier).toBe('base');
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

  it('names tools by their type and the rest by an adjective and the type', () => {
    for (const { token } of TOKENS) {
      const type = types.get(token.type);
      if (type.tool) expect(token.name).toEqual({ kind: 'noun', noun: token.type });
      else expect(token.name).toMatchObject({ kind: 'adjective', noun: token.type });
    }
  });

  it('builds the spec sheet description from the token data', () => {
    const axe = created(contextFor(2, { type: 'axe', tokenType: ETokenType.GLOOM, mapTier: 3 }));
    expect(axe.description[0]).toEqual({
      key: 'content.tokens.line.kind',
      params: { type: 'content.tokens.noun.axe', tokenType: 'content.tokens.tokenType.gloom' },
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
      expect(token.description.some((line) => line.key.startsWith('content.tokens.attr.'))).toBe(
        false,
      );
    }
  });

  it('keeps the top-level shape of a base token', () => {
    expect(Object.keys(TOKENS[0].token).sort()).toEqual(
      [
        'attributes',
        'baseKey',
        'description',
        'dimension',
        'ext',
        'generatorVersion',
        'id',
        'mapTier',
        'name',
        'tier',
        'price',
        'tokenType',
        'skills',
        'sprite',
        'type',
      ].sort(),
    );
  });

  it('matches the golden tokens of 20 fixed seeds', () => {
    const golden = Array.from({ length: 20 }, (_, index) =>
      created(contextFor(1000 + index, { sourceId: 'test:golden', n: index })),
    );
    expect(golden).toMatchSnapshot();
  });
});
