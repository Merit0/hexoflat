import { describe, expect, it } from 'vitest';
import { ERarityKind } from '../abstraction/hexobject-abstraction';
import { TOKEN_PRICE_RANGES } from '../content/token-prices.content';
import { TOKEN_UNIQUES } from '../content/token-uniques.content';
import { TRADERS } from '../content/traders.content';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { gameTokenFactory } from '../tokens/game-tokens';
import { BASE_REALMS, MAP_TIERS } from '../tokens/token-keys';
import type { ItemToken } from '../tokens/token-schema';
import { priceOf, sellPriceOf } from './price-of';

const ILVA = TRADERS.ilva;
const SAMPLES = 40;

function entry(token: ItemToken) {
  return { key: token.type as THexobjectKey, token };
}

function expectedSell(price: number): number {
  return Math.max(1, Math.floor((price * ILVA.sellRate.num) / ILVA.sellRate.den));
}

function baseTokens(realm: ERarityKind): ItemToken[] {
  return Array.from({ length: SAMPLES }, (_, index) => {
    const made = gameTokenFactory().createBase({
      seed: `da2-c10-${realm}-${index}`,
      sourceId: 'test:da2.c10',
      n: index,
      realm,
      mapTier: MAP_TIERS[index % MAP_TIERS.length],
    });
    if (!made.ok) throw new Error(made.refusal.code);
    return made.value;
  });
}

function uniqueToken(uniqueKey: string): ItemToken {
  const made = gameTokenFactory().createUnique(uniqueKey, {
    seed: 'da2-c10-unique',
    sourceId: 'test:da2.c10',
    n: 0,
    mapTier: 4,
    ownedUniques: [],
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe('DA2 C10: prices per ERarityKind', () => {
  it('C10: the price table has a range for every base kind and none for alien', () => {
    expect(Object.keys(TOKEN_PRICE_RANGES).sort()).toEqual([...BASE_REALMS].sort());
    expect(ERarityKind.ALIEN in TOKEN_PRICE_RANGES).toBe(false);
  });

  it.each(BASE_REALMS)(
    'C10: a %s base token price is inside its range and sells by sellRate',
    (realm) => {
      const [min, max] = TOKEN_PRICE_RANGES[realm];
      for (const token of baseTokens(realm)) {
        const price = priceOf(entry(token))!;
        expect(price).toBe(token.price);
        expect(price).toBeGreaterThanOrEqual(min);
        expect(price).toBeLessThanOrEqual(max);
        expect(sellPriceOf(ILVA, entry(token))).toBe(expectedSell(price));
      }
    },
  );

  it.each(TOKEN_UNIQUES.map((unique) => [unique.rarity, unique.key, unique.price] as const))(
    'C10: a %s unique (%s) costs its definition price %i and sells by sellRate',
    (rarity, key, price) => {
      const token = uniqueToken(key);
      expect(token.rarity).toBe(rarity);
      expect(priceOf(entry(token))).toBe(price);
      expect(sellPriceOf(ILVA, entry(token))).toBe(expectedSell(price));
    },
  );

  it('C10: every ERarityKind is covered by a base range or a unique definition', () => {
    const covered = new Set<string>([
      ...Object.keys(TOKEN_PRICE_RANGES),
      ...TOKEN_UNIQUES.map((unique) => unique.rarity),
    ]);
    expect([...covered].sort()).toEqual(Object.values(ERarityKind).sort());
  });

  it('C10: the trader sell rate is the integer fraction 2/5 and coins are not sellable', () => {
    expect(ILVA.sellRate).toEqual({ num: 2, den: 5 });
    expect(sellPriceOf(ILVA, { key: HEXOBJECT_KEYS.COINS })).toBeNull();
  });
});
