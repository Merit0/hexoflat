import { describe, expect, it } from 'vitest';
import { emptyProgressState } from '../aggregates/progress-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { applyTraderFixture, traderFixtureSchema } from './trader-fixture';
import { ILVA } from './trade-test-setup';
import { traderView } from './trader-view';

const SEED = 'server-seed';
const { SWORD, HEALTH_BOTTLE, COINS, HAND } = HEXOBJECT_KEYS;

describe('applyTraderFixture', () => {
  it('sets goods, buyback and trips, padding both rows to the trader slots', () => {
    const progress = emptyProgressState('hero-1');
    const next = applyTraderFixture(progress, SEED, {
      trader: 'ilva',
      goods: [{ key: SWORD, amount: 1 }, null, { key: HEALTH_BOTTLE, amount: 3 }],
      buyback: [{ key: SWORD, amount: 1, unitPrice: 200 }],
      trips: 3,
    })!;
    const trader = next.traders.ilva!;
    expect(next.trips).toBe(3);
    expect(trader.goods).toHaveLength(ILVA.goodsSlots);
    expect(trader.goods.slice(0, 4)).toEqual([
      { key: SWORD, amount: 1 },
      null,
      { key: HEALTH_BOTTLE, amount: 3 },
      null,
    ]);
    expect(trader.buyback).toHaveLength(ILVA.buybackSlots);
    expect(trader.buyback[0]).toEqual({ key: SWORD, amount: 1, unitPrice: 200 });
    expect(trader.trip).toBe(3);
    expect(progress.traders).toEqual({});
  });

  it('keeps the rolled goods when only trips are given', () => {
    const progress = emptyProgressState('hero-1');
    const next = applyTraderFixture(progress, SEED, { trader: 'ilva', trips: 2 })!;
    expect(next.traders.ilva!.goods).toEqual(traderView(progress, 'ilva', SEED).goods);
  });

  it('refuses rows longer than the trader slots and keys that have no coin price', () => {
    const progress = emptyProgressState('hero-1');
    const sword = { key: SWORD, amount: 1 };
    const tooMany = Array.from({ length: ILVA.goodsSlots + 1 }, () => sword);
    expect(applyTraderFixture(progress, SEED, { trader: 'ilva', goods: tooMany })).toBeNull();
    for (const key of [COINS, HAND]) {
      expect(
        applyTraderFixture(progress, SEED, { trader: 'ilva', goods: [{ key, amount: 1 }] }),
      ).toBeNull();
    }
  });

  it('parses strictly', () => {
    expect(traderFixtureSchema.safeParse({ trader: 'ilva', extra: 1 }).success).toBe(false);
    expect(traderFixtureSchema.safeParse({ trader: 'nobody' }).success).toBe(false);
    expect(traderFixtureSchema.safeParse({ trader: 'ilva', trips: -1 }).success).toBe(false);
  });
});
