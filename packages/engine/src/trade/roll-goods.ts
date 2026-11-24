import { dimensionOfTokenType } from '../dimensions/dimensions';
import { CONTENT } from '../content/content-map';
import { dropAvailableIn } from '../loot/dimension-pool';
import type { TTraderDefinition } from '../content/content-schema';
import type { RandomNumberGenerator } from '../utils/random';
import type { TraderGood } from './trade-state';

type TStockRange = TTraderDefinition['guaranteed'][number];
type TPoolEntry = TTraderDefinition['pool'][number];

function rollAmount(range: TStockRange, rng: RandomNumberGenerator): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

function pickWeighted(pool: TPoolEntry[], rng: RandomNumberGenerator): number {
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (let index = 0; index < pool.length; index += 1) {
    roll -= pool[index].weight;
    if (roll < 0) return index;
  }
  return pool.length - 1;
}

export function rollGoods(
  def: TTraderDefinition,
  rng: RandomNumberGenerator,
): (TraderGood | null)[] {
  const dimension = def.dropContext
    ? dimensionOfTokenType(def.dropContext.tokenType)
    : CONTENT[def.stallHexobjectKey].dimension;
  for (const entry of def.guaranteed) {
    if (!dropAvailableIn({ itemKey: entry.key }, dimension))
      throw new Error(`TRADER_GUARANTEED_OUTSIDE_DIMENSION: ${entry.key}`);
  }
  const goods: (TraderGood | null)[] = def.guaranteed.map((range) => ({
    key: range.key,
    amount: rollAmount(range, rng),
  }));
  const pool = def.pool.filter((entry) => dropAvailableIn({ itemKey: entry.key }, dimension));
  for (let roll = 0; roll < def.rolls && pool.length > 0; roll += 1) {
    const [picked] = pool.splice(pickWeighted(pool, rng), 1);
    goods.push({ key: picked.key, amount: rollAmount(picked, rng) });
  }
  while (goods.length < def.goodsSlots) goods.push(null);
  return goods.slice(0, def.goodsSlots);
}

export function emptyBuyback(def: TTraderDefinition): null[] {
  return Array.from({ length: def.buybackSlots }, () => null);
}
