import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { createTokenRegistries, TOKEN_CONTENT } from '../content/token-content';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { EDimension } from '../dimensions/dimensions';
import { createTokenFactory } from './factory/create-token-factory';
import { ZodTokenValidator } from './factory/token-validator';
import type { GenerationContext } from './factory/token-generation';
import { lightTone } from './light-tone';
import { itemTokenSchema, type ItemToken } from './token-schema';

const shared = createTokenFactory({
  ...TOKEN_CONTENT,
  baseItems: TOKEN_CONTENT.baseItems.map((item) =>
    item.key === 'earth-sword' ? { ...item, sharedWith: [EDimension.UNDERWORLD] } : item,
  ),
});

function underworldDrop(n: number, extra: Partial<GenerationContext> = {}): ItemToken {
  const made = shared.createBase({
    seed: `da2-b9-${n}`,
    sourceId: 'test:da2.b9',
    n,
    tokenType: ETokenType.GLOOM,
    mapTier: 2,
    type: 'sword',
    ...extra,
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('DA2 B9/D4: an EARTH base shared with UNDERWORLD, dropped in UNDERWORLD', () => {
  it('B9 (D4): the token takes the carrier dimension (gloom), not the base owner one', () => {
    const token = underworldDrop(0, { baseKey: 'earth-sword' });
    expect(token).toMatchObject({
      baseKey: 'earth-sword',
      dimension: EDimension.UNDERWORLD,
      tokenType: ETokenType.GLOOM,
    });
    expect(lightTone(token.tier, token.tokenType)).toBe('gloom-base');
    const [min, max] = TOKEN_PRICE_RANGES.gloom;
    expect(token.price).toBeGreaterThanOrEqual(min);
    expect(token.price).toBeLessThanOrEqual(max);
    expect(itemTokenSchema.parse(token)).toEqual(token);
  });

  it('B9 (D4): a generic UNDERWORLD sword drop is gloom, whichever base it picks', () => {
    const tokens = Array.from({ length: 40 }, (_, n) => underworldDrop(n));
    const picked = tokens.filter((token) => token.baseKey === 'earth-sword');
    const own = tokens.filter((token) => token.baseKey === 'underworld-sword');
    expect(picked.length).toBeGreaterThan(0);
    expect(own.length).toBeGreaterThan(0);
    for (const token of tokens)
      expect(token).toMatchObject({ dimension: 'underworld', tokenType: 'gloom' });
  });

  it('B9: the schema checks only the base type, so a stored token survives a lost sharing', () => {
    const token = underworldDrop(0, { baseKey: 'earth-sword' });
    expect(itemTokenSchema.safeParse(token).success).toBe(true);
    expect(itemTokenSchema.safeParse({ ...token, baseKey: 'earth-shield' }).success).toBe(false);
  });

  it('B9: minting still refuses a base that is not shared with the carrier dimension', () => {
    const unshared = createTokenFactory().createBase({
      seed: 'da2-b9-unshared',
      sourceId: 'test:da2.b9',
      n: 0,
      tokenType: ETokenType.GLOOM,
      mapTier: 2,
      baseKey: 'earth-sword',
    });
    expect(unshared).toMatchObject({ ok: false, refusal: { code: 'BASE_ITEM_NOT_IN_DIMENSION' } });
  });

  it('B9: the validator refuses a token whose base is not shared with its dimension', () => {
    const token = underworldDrop(0, { baseKey: 'earth-sword' });
    const { types, attributes, baseItems, uniques } = createTokenRegistries();
    const profiles = TOKEN_CONTENT.profiles;
    const validator = new ZodTokenValidator(types, attributes, profiles, baseItems, {
      uniques,
      profiles,
    });
    expect(validator.validate(token)).toMatchObject({
      ok: false,
      refusal: { code: 'INVALID_TOKEN', message: 'Invalid concrete base item identity' },
    });
  });
});
