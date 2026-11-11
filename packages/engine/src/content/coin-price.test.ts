import { describe, expect, it } from 'vitest';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coinPriceOf } from './content-accessors';
import { CONTENT } from './content-map';
import { TRADERS } from './traders.content';
import { discountedUnit } from '../trade/discount-math';

const ALL_KEYS = Object.keys(CONTENT) as THexobjectKey[];
const BAG_GROUPS = new Set([EHexobjectGroup.LOOT, EHexobjectGroup.TOOL, EHexobjectGroup.EQUIPMENT]);
const NEVER_PRICED = new Set<THexobjectKey>([HEXOBJECT_KEYS.COINS, HEXOBJECT_KEYS.HAND]);
const bagKeys = ALL_KEYS.filter((key) => BAG_GROUPS.has(CONTENT[key].groupType));

describe('coinPrice: what an item costs at a trader', () => {
  it('prices every item that can lie in the bag, except coins and the bare hand', () => {
    const missing = bagKeys.filter((key) => !NEVER_PRICED.has(key) && coinPriceOf(key) === null);
    expect(missing).toEqual([]);
  });

  it('never prices coins or the bare hand', () => {
    expect(coinPriceOf(HEXOBJECT_KEYS.COINS)).toBeNull();
    expect(coinPriceOf(HEXOBJECT_KEYS.HAND)).toBeNull();
  });

  it('prices nothing that cannot lie in the bag', () => {
    const priced = ALL_KEYS.filter((key) => !BAG_GROUPS.has(CONTENT[key].groupType));
    expect(priced.filter((key) => coinPriceOf(key) !== null)).toEqual([]);
  });

  it('keeps every price divisible by 20, so 10%, 20%, 25% and 50% discounts stay whole coins', () => {
    const odd = ALL_KEYS.filter((key) => {
      const price = coinPriceOf(key);
      return price !== null && price % 20 !== 0;
    });
    expect(odd).toEqual([]);
  });

  it('gives every priced item a whole discounted price for every discount the trader can roll', () => {
    const percents = TRADERS.ilva.discounts?.percents ?? [];
    const inexact = bagKeys.flatMap((key) =>
      coinPriceOf(key) === null
        ? []
        : percents
            .filter((percent) => discountedUnit(key, percent) === null)
            .map((p) => `${key}:${p}`),
    );
    expect(inexact).toEqual([]);
  });

  it('matches the approved price table', () => {
    const table = Object.fromEntries(
      bagKeys.filter((key) => coinPriceOf(key) !== null).map((key) => [key, coinPriceOf(key)]),
    );
    expect(table).toEqual({
      [HEXOBJECT_KEYS.HEALTH_BOTTLE]: 20,
      [HEXOBJECT_KEYS.ENERGY_BOTTLE]: 20,
      [HEXOBJECT_KEYS.MANA_BOTTLE]: 20,
      [HEXOBJECT_KEYS.BONE_CHARM]: 40,
      [HEXOBJECT_KEYS.SHIELD]: 40,
      [HEXOBJECT_KEYS.AXE]: 60,
      [HEXOBJECT_KEYS.PICKAXE]: 60,
      [HEXOBJECT_KEYS.RETURN_SCROLL]: 60,
      [HEXOBJECT_KEYS.CROWN_SHARD]: 80,
      [HEXOBJECT_KEYS.SWORD]: 500,
    });
  });

  it('throws on an unknown key', () => {
    expect(() => coinPriceOf('no-such-item' as THexobjectKey)).toThrow(/Unknown Hexobject key/);
  });
});
