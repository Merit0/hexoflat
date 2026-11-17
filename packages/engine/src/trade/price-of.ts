import { coinPriceOf } from '../content/content-accessors';
import type { TTraderDefinition } from '../content/content-schema';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import type { ItemToken } from '../tokens/token-schema';

export interface PricedEntry {
  key: THexobjectKey;
  token?: ItemToken;
}

export function priceOf(entry: PricedEntry): number | null {
  return entry.token ? entry.token.price : coinPriceOf(entry.key);
}

export function sellPriceFrom(def: TTraderDefinition, price: number | null): number | null {
  if (price === null) return null;
  return Math.max(1, Math.floor((price * def.sellRate.num) / def.sellRate.den));
}

export function sellPriceOf(def: TTraderDefinition, entry: PricedEntry): number | null {
  if (entry.key === HEXOBJECT_KEYS.COINS) return null;
  return sellPriceFrom(def, priceOf(entry));
}
