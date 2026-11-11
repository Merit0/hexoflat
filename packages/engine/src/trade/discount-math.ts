import { coinPriceOf } from '../content/content-accessors';
import type { TTraderDefinition } from '../content/content-schema';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { RandomNumberGenerator } from '../utils/random';
import type { TraderGood } from './trade-state';

const MAX_GUESS = 999;

export function discountedUnit(key: THexobjectKey, percent: number): number | null {
  const price = coinPriceOf(key);
  if (price === null) return null;
  const scaled = price * (100 - percent);
  if (scaled % 100 !== 0) return null;
  const unit = scaled / 100;
  return unit >= 1 && unit <= MAX_GUESS ? unit : null;
}

function exactPercents(def: TTraderDefinition, key: THexobjectKey): number[] {
  return (def.discounts?.percents ?? []).filter((percent) => discountedUnit(key, percent) !== null);
}

export function applyDiscounts(
  def: TTraderDefinition,
  goods: (TraderGood | null)[],
  rng: RandomNumberGenerator,
): (TraderGood | null)[] {
  const rule = def.discounts;
  if (!rule) return goods;
  let left = rule.maxGoods;
  return goods.map((good) => {
    if (!good || left <= 0) return good;
    const options = exactPercents(def, good.key);
    if (options.length === 0 || rng() * 100 >= rule.chancePct) return good;
    left -= 1;
    return { ...good, discountPercent: options[Math.floor(rng() * options.length)] };
  });
}
