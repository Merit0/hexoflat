import { describe, expect, it } from 'vitest';
import { mintItem } from '../inventory/inventory-state';
import { planBuy } from './plan-buy';
import { planSell } from './plan-sell';
import { walletCoins } from './trader-view';
import {
  AXE,
  COINS,
  HEALTH_BOTTLE,
  MANA_BOTTLE,
  SHIELD,
  SWORD,
  bagAmount,
  fullBag,
  inventoryWith,
  traderWith,
} from './trade-test-setup';

const whole = (expectedPrice: number) => ({ split: false, expectedPrice });

describe('planSell', () => {
  it('takes the stack, pays coins into the bag and lists it in BUYBACK at the sell price', () => {
    const inventory = inventoryWith({ 0: [COINS, 5], 3: [HEALTH_BOTTLE, 3] });
    const result = planSell(inventory, traderWith([]), 3, whole(24));
    if (!result.ok) throw new Error(result.reason);
    expect(result).toMatchObject({ key: HEALTH_BOTTLE, amount: 3, price: 24 });
    expect(result.inventory.bag[3]).toBeNull();
    expect(result.inventory.bag[0]).toMatchObject({ key: COINS, amount: 29 });
    expect(result.trader.buyback[0]).toEqual({ key: HEALTH_BOTTLE, amount: 3, unitPrice: 8 });
  });

  it('sells half a stack with Shift', () => {
    const inventory = inventoryWith({ 2: [HEALTH_BOTTLE, 5] });
    const result = planSell(inventory, traderWith([]), 2, { split: true, expectedPrice: 16 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[2]).toMatchObject({ key: HEALTH_BOTTLE, amount: 3 });
    expect(bagAmount(result.inventory, COINS)).toBe(16);
    expect(result.trader.buyback[0]).toEqual({ key: HEALTH_BOTTLE, amount: 2, unitPrice: 8 });
  });

  it('sells exactly the amount asked for and keeps the rest', () => {
    const inventory = inventoryWith({ 2: [HEALTH_BOTTLE, 5] });
    const result = planSell(inventory, traderWith([]), 2, {
      split: false,
      amount: 2,
      expectedPrice: 16,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[2]).toMatchObject({ key: HEALTH_BOTTLE, amount: 3 });
    expect(result.trader.buyback[0]).toEqual({ key: HEALTH_BOTTLE, amount: 2, unitPrice: 8 });
  });

  it('never sells more than the stack holds', () => {
    const inventory = inventoryWith({ 2: [HEALTH_BOTTLE, 5] });
    const result = planSell(inventory, traderWith([]), 2, {
      split: false,
      amount: 99,
      expectedPrice: 40,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.amount).toBe(5);
  });

  it('gives back exactly the coins it paid when the same stack is bought back', () => {
    const inventory = inventoryWith({ 0: [COINS, 50], 1: [SWORD, 1], 2: [MANA_BOTTLE, 4] });
    let trader = traderWith([]);
    const soldSword = planSell(inventory, trader, 1, whole(200));
    if (!soldSword.ok) throw new Error(soldSword.reason);
    trader = { ...trader, state: soldSword.trader };
    const soldMana = planSell(soldSword.inventory, trader, 2, whole(32));
    if (!soldMana.ok) throw new Error(soldMana.reason);
    trader = { ...trader, state: soldMana.trader };
    expect(walletCoins(soldMana.inventory)).toBe(282);

    const backSword = planBuy(
      soldMana.inventory,
      trader,
      { list: 'buyback', index: 0 },
      'auto',
      whole(200),
    );
    if (!backSword.ok) throw new Error(backSword.reason);
    trader = { ...trader, state: backSword.trader };
    const backMana = planBuy(
      backSword.inventory,
      trader,
      { list: 'buyback', index: 0 },
      'auto',
      whole(32),
    );
    if (!backMana.ok) throw new Error(backMana.reason);
    expect(walletCoins(backMana.inventory)).toBe(50);
    expect(bagAmount(backMana.inventory, SWORD)).toBe(1);
    expect(bagAmount(backMana.inventory, MANA_BOTTLE)).toBe(4);
    expect(backMana.trader.buyback.every((cell) => cell === null)).toBe(true);
  });

  it('refuses to buy coins, an empty cell and anything without a price', () => {
    const inventory = inventoryWith({ 0: [COINS, 50] });
    expect(planSell(inventory, traderWith([]), 0, whole(1))).toMatchObject({
      ok: false,
      reason: 'NOT_TRADEABLE',
    });
    expect(planSell(inventory, traderWith([]), 1, whole(1))).toMatchObject({
      ok: false,
      reason: 'EMPTY_SOURCE',
    });
    const hand = inventoryWith({});
    hand.bag[0] = mintItem(hand, 'hand', 1);
    expect(planSell(hand, traderWith([]), 0, whole(1))).toMatchObject({
      ok: false,
      reason: 'NOT_TRADEABLE',
    });
  });

  it('refuses a price that is not the one the client saw', () => {
    const inventory = inventoryWith({ 0: [AXE, 1] });
    expect(planSell(inventory, traderWith([]), 0, whole(25))).toEqual({
      ok: false,
      reason: 'PRICE_CHANGED',
      price: 24,
    });
  });

  it('pays into a full bag only when the sold stack frees its cell or coins can join a stack', () => {
    const full = fullBag(MANA_BOTTLE);
    full.bag[4] = mintItem(full, HEALTH_BOTTLE, 4);
    expect(planSell(full, traderWith([]), 4, { split: true, expectedPrice: 16 })).toEqual({
      ok: false,
      reason: 'CONTAINER_FULL',
      price: 16,
    });
    const all = planSell(full, traderWith([]), 4, whole(32));
    if (!all.ok) throw new Error(all.reason);
    expect(all.inventory.bag[4]).toMatchObject({ key: COINS, amount: 32 });

    full.bag[9] = mintItem(full, COINS, 3);
    const joined = planSell(full, traderWith([]), 4, { split: true, expectedPrice: 16 });
    if (!joined.ok) throw new Error(joined.reason);
    expect(joined.inventory.bag[9]).toMatchObject({ key: COINS, amount: 19 });
  });
});

describe('BUYBACK after a sale', () => {
  it('joins sales of the same stackable item and price, but keeps single items apart', () => {
    let inventory = inventoryWith({
      0: [HEALTH_BOTTLE, 2],
      1: [HEALTH_BOTTLE, 3],
      2: [SHIELD, 1],
      3: [SHIELD, 1],
    });
    let trader = traderWith([]);
    for (const [index, price] of [
      [0, 16],
      [1, 24],
      [2, 16],
      [3, 16],
    ] as const) {
      const sold = planSell(inventory, trader, index, whole(price));
      if (!sold.ok) throw new Error(sold.reason);
      inventory = sold.inventory;
      trader = { ...trader, state: sold.trader };
    }
    expect(trader.state.buyback.slice(0, 4)).toEqual([
      { key: HEALTH_BOTTLE, amount: 5, unitPrice: 8 },
      { key: SHIELD, amount: 1, unitPrice: 16 },
      { key: SHIELD, amount: 1, unitPrice: 16 },
      null,
    ]);
  });

  it('drops the oldest sale when BUYBACK is full', () => {
    const trader = traderWith(
      [],
      [
        [AXE, 1, 19],
        [SHIELD, 1, 16],
        [SWORD, 1, 200],
        [AXE, 1, 19],
        [SHIELD, 1, 16],
        [SWORD, 1, 200],
        [AXE, 1, 19],
      ],
    );
    const inventory = inventoryWith({ 0: [MANA_BOTTLE, 1] });
    const result = planSell(inventory, trader, 0, whole(8));
    if (!result.ok) throw new Error(result.reason);
    expect(result.trader.buyback).toHaveLength(7);
    expect(result.trader.buyback[0]).toEqual({ key: SHIELD, amount: 1, unitPrice: 16 });
    expect(result.trader.buyback[6]).toEqual({ key: MANA_BOTTLE, amount: 1, unitPrice: 8 });
  });
});
