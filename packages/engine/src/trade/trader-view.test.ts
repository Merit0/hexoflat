import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { coinPriceOf } from '../content/content-accessors';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import { rollGoods } from './roll-goods';
import { rollTraderGoods } from './trader-view';
import { refreshPrice, sellUnitPrice, traderView, walletCoins } from './trader-view';
import { COINS, HERO, ILVA, SEED, inventoryWith } from './trade-test-setup';

const APPROVED_SELL_PRICES: Partial<Record<THexobjectKey, number>> = {
  [HEXOBJECT_KEYS.HEALTH_BOTTLE]: 4,
  [HEXOBJECT_KEYS.ENERGY_BOTTLE]: 4,
  [HEXOBJECT_KEYS.MANA_BOTTLE]: 4,
  [HEXOBJECT_KEYS.BONE_CHARM]: 9,
  [HEXOBJECT_KEYS.SHIELD]: 16,
  [HEXOBJECT_KEYS.AXE]: 19,
  [HEXOBJECT_KEYS.PICKAXE]: 19,
  [HEXOBJECT_KEYS.RETURN_SCROLL]: 24,
  [HEXOBJECT_KEYS.CROWN_SHARD]: 32,
  [HEXOBJECT_KEYS.SWORD]: 200,
};

describe('sellUnitPrice', () => {
  it('pays two fifths of the coin price, rounded down, for every priced item (table 4.1)', () => {
    const priced = Object.values(HEXOBJECT_KEYS).filter((key) => coinPriceOf(key) !== null);
    const table = Object.fromEntries(priced.map((key) => [key, sellUnitPrice(ILVA, key)]));
    expect(table).toEqual(APPROVED_SELL_PRICES);
  });

  it('buys neither coins nor anything without a price', () => {
    expect(sellUnitPrice(ILVA, COINS)).toBeNull();
    expect(sellUnitPrice(ILVA, HEXOBJECT_KEYS.HAND)).toBeNull();
    expect(sellUnitPrice(ILVA, HEXOBJECT_KEYS.TREE)).toBeNull();
  });

  it('never pays less than one coin, and uses whole numbers only', () => {
    const stingy = { ...ILVA, sellRate: { num: 1, den: 100 } };
    expect(sellUnitPrice(stingy, HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(1);
    const third = { ...ILVA, sellRate: { num: 1, den: 3 } };
    expect(sellUnitPrice(third, HEXOBJECT_KEYS.RETURN_SCROLL)).toBe(20);
    expect(sellUnitPrice(third, HEXOBJECT_KEYS.BONE_CHARM)).toBe(8);
  });
});

describe('refreshPrice', () => {
  const state = (trip: number, paidRefreshes: number) => ({
    serial: paidRefreshes,
    trip,
    paidRefreshes,
    goods: [],
    buyback: [],
  });

  it('is 20 Will, then 40, then 80 within one trip', () => {
    expect(refreshPrice(state(0, 0), 0, ILVA)).toBe(20);
    expect(refreshPrice(state(0, 1), 0, ILVA)).toBe(40);
    expect(refreshPrice(state(0, 2), 0, ILVA)).toBe(80);
  });

  it('falls back to 20 once the hero has been to the cave again', () => {
    expect(refreshPrice(state(0, 2), 1, ILVA)).toBe(20);
    expect(refreshPrice(state(3, 1), 5, ILVA)).toBe(20);
  });
});

describe('walletCoins', () => {
  it('adds the coins in the bag and in both hands, never other items', () => {
    const inventory = inventoryWith(
      { 0: [COINS, 30], 5: [COINS, 7], 6: [HEXOBJECT_KEYS.HEALTH_BOTTLE, 3] },
      { weapon: [COINS, 100], shield: [HEXOBJECT_KEYS.SHIELD, 1] },
    );
    expect(walletCoins(inventory)).toBe(137);
  });

  it('ignores coins kept in the stash', () => {
    const inventory = inventoryWith({ 1: [COINS, 5] });
    inventory.stash.chests = 1;
    inventory.stash.cells[0] = { id: 'x', key: COINS, type: inventory.bag[1]!.type, amount: 900 };
    expect(walletCoins(inventory)).toBe(5);
  });
});

describe('rollGoods', () => {
  const roll = (seed: string, serial: number) =>
    rollGoods(ILVA, deriveStream(seed, `trader:ilva:${serial}`));

  it('lays out the guaranteed potion first and six different picks from the pool', () => {
    for (let serial = 0; serial < 30; serial += 1) {
      const goods = roll(SEED, serial);
      expect(goods).toHaveLength(ILVA.goodsSlots);
      expect(goods[0]?.key).toBe(HEXOBJECT_KEYS.HEALTH_BOTTLE);
      expect(goods[0]?.amount).toBeGreaterThanOrEqual(2);
      expect(goods[0]?.amount).toBeLessThanOrEqual(5);
      const picks = goods.slice(1);
      expect(new Set(picks.map((good) => good?.key)).size).toBe(ILVA.rolls);
      for (const good of picks) {
        const range = ILVA.pool.find((entry) => entry.key === good?.key);
        expect(range).toBeDefined();
        expect(good!.amount).toBeGreaterThanOrEqual(range!.min);
        expect(good!.amount).toBeLessThanOrEqual(range!.max);
      }
    }
  });

  it('is the same for the same seed and serial, and differs between serials and seeds', () => {
    expect(roll(SEED, 0)).toEqual(roll(SEED, 0));
    expect(roll(SEED, 1)).not.toEqual(roll(SEED, 0));
    expect(roll('another-seed', 0)).not.toEqual(roll(SEED, 0));
  });

  it('leaves the rest empty when the pool is smaller than the slots', () => {
    const small = { ...ILVA, pool: ILVA.pool.slice(0, 2), rolls: 2 };
    const goods = rollGoods(small, deriveStream(SEED, 'small'));
    expect(goods.filter(Boolean)).toHaveLength(3);
    expect(goods.slice(3)).toEqual(Array.from({ length: ILVA.goodsSlots - 3 }, () => null));
  });
});

describe('traderView', () => {
  it('builds serial 0 from the server seed for a trader never touched', () => {
    const progress = emptyProgressState(HERO);
    progress.trips = 2;
    const view = traderView(progress, 'ilva', SEED);
    expect(view).toEqual({
      serial: 0,
      trip: 2,
      paidRefreshes: 0,
      goods: rollTraderGoods(ILVA, SEED, 'ilva', 0),
      buyback: Array.from({ length: ILVA.buybackSlots }, () => null),
    });
    expect(traderView(progress, 'ilva', SEED)).toEqual(view);
    expect(progress.traders).toEqual({});
  });

  it('returns the stored trader once there is one', () => {
    const progress = emptyProgressState(HERO);
    const stored = { serial: 4, trip: 1, paidRefreshes: 2, goods: [], buyback: [] };
    progress.traders.ilva = stored;
    expect(traderView(progress, 'ilva', SEED)).toBe(stored);
  });
});
