import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { coinHandSlot, coinsInHand, planUnlockStashChest } from './item-transfer';
import {
  STASH_CAPACITY,
  STASH_CHEST_CELLS,
  STASH_CHEST_PRICES,
  STASH_MAX_CHESTS,
  stashChestPrice,
} from './stash-constants';
import { emptyStash, openStashCells } from './stash-state';
import { aggregate, item } from './item-transfer-test-setup';
import type { TUnlockChestResult } from './plan-unlock-chest';

function unlocked(result: TUnlockChestResult) {
  if (!result.ok) throw new Error(`expected an unlock, got ${result.reason}`);
  return result;
}

describe('stash chests', () => {
  it('is six rows of seven cells, five chests at most', () => {
    expect(STASH_CHEST_CELLS).toBe(42);
    expect(STASH_MAX_CHESTS).toBe(5);
    expect(STASH_CAPACITY).toBe(210);
  });

  it('costs 100 coins for the first chest and 1000 for each next one', () => {
    expect([0, 1, 2, 3, 4].map(stashChestPrice)).toEqual([100, 1000, 1000, 1000, 1000]);
    expect(STASH_CHEST_PRICES).toHaveLength(STASH_MAX_CHESTS);
    expect(stashChestPrice(5)).toBeNull();
    expect(stashChestPrice(-1)).toBeNull();
  });

  it('starts with no open cells and opens one chest at a time', () => {
    expect(emptyStash().cells).toHaveLength(STASH_CAPACITY);
    expect(openStashCells(emptyStash())).toHaveLength(0);
    expect(openStashCells(emptyStash(2))).toHaveLength(84);
    expect(emptyStash(9).chests).toBe(STASH_MAX_CHESTS);
  });
});

describe('planUnlockStashChest', () => {
  const holding = (coins: number, slot: 'weapon' | 'shield' = 'weapon') =>
    aggregate({ worn: { [slot]: item(K.COINS, coins, 'hand-coins') }, stashSize: 0 });

  it('takes exactly 100 from the hand for the first chest and leaves the rest there', () => {
    const done = unlocked(planUnlockStashChest(holding(140), 0, 'weapon'));
    expect(done.chests).toBe(1);
    expect(done.price).toBe(100);
    expect(done.next.equip.weapon).toMatchObject({ id: 'hand-coins', amount: 40 });
    expect(done.next.stash).toHaveLength(42);
    expect(done.next.stash.every((cell) => cell === null)).toBe(true);
  });

  it('empties the hand slot when the stack is exactly the price', () => {
    const done = unlocked(planUnlockStashChest(holding(100), 0, 'weapon'));
    expect(done.next.equip.weapon).toBeNull();
  });

  it('refuses 90 coins for a 100 coin chest and reports the price', () => {
    expect(planUnlockStashChest(holding(90), 0, 'weapon')).toEqual({
      ok: false,
      reason: 'NOT_ENOUGH_COINS',
      price: 100,
    });
  });

  it('charges 1000 for the second chest and keeps what the first chest holds', () => {
    const agg = {
      ...holding(1500),
      stash: Array.from({ length: 42 }, (_, i) => (i === 3 ? item(K.SWORD, 1, 'kept') : null)),
    };
    const done = unlocked(planUnlockStashChest(agg, 1, 'weapon'));
    expect(done.price).toBe(1000);
    expect(done.next.equip.weapon?.amount).toBe(500);
    expect(done.next.stash).toHaveLength(84);
    expect(done.next.stash[3]?.id).toBe('kept');
  });

  it('works from the shield hand as well', () => {
    const done = unlocked(planUnlockStashChest(holding(150, 'shield'), 0, 'shield'));
    expect(done.next.equip.shield?.amount).toBe(50);
  });

  it('ignores coins in the bag and the stash', () => {
    const agg = aggregate({
      bag: { 0: item(K.COINS, 5000) },
      stash: { 0: item(K.COINS, 5000) },
      worn: { weapon: item(K.COINS, 99) },
    });
    expect(planUnlockStashChest(agg, 0, 'weapon')).toMatchObject({
      ok: false,
      reason: 'NOT_ENOUGH_COINS',
    });
  });

  it('refuses a hand that does not hold coins', () => {
    const agg = aggregate({ worn: { weapon: item(K.SWORD) }, bag: { 0: item(K.COINS, 500) } });
    expect(planUnlockStashChest(agg, 0, 'weapon')).toEqual({
      ok: false,
      reason: 'NO_COINS_IN_HAND',
      price: 100,
    });
    expect(planUnlockStashChest(agg, 0, 'shield')).toMatchObject({ reason: 'NO_COINS_IN_HAND' });
  });

  it('refuses once all five chests are unlocked', () => {
    expect(planUnlockStashChest(holding(99999), 5, 'weapon')).toEqual({
      ok: false,
      reason: 'MAX_CHESTS',
      price: null,
    });
  });

  it('does not change the aggregate it was given', () => {
    const agg = holding(500);
    const before = JSON.stringify(agg);
    planUnlockStashChest(agg, 0, 'weapon');
    expect(JSON.stringify(agg)).toBe(before);
  });
});

describe('coinHandSlot', () => {
  it('finds the hand with the biggest coin stack, or none', () => {
    expect(coinHandSlot(aggregate({}))).toBeNull();
    expect(coinHandSlot(aggregate({ worn: { shield: item(K.COINS, 7) } }))).toBe('shield');
    const both = aggregate({ worn: { weapon: item(K.COINS, 7), shield: item(K.COINS, 30) } });
    expect(coinHandSlot(both)).toBe('shield');
    expect(coinsInHand(both, 'weapon')).toBe(7);
    expect(coinsInHand(aggregate({ worn: { weapon: item(K.SWORD) } }), 'weapon')).toBe(0);
  });
});
