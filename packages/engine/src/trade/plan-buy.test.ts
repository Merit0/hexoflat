import { describe, expect, it } from 'vitest';
import { mintItem } from '../inventory/inventory-state';
import { planBuy } from './plan-buy';
import { walletCoins } from './trader-view';
import {
  AXE,
  COINS,
  HEALTH_BOTTLE,
  MANA_BOTTLE,
  SWORD,
  bagAmount,
  fullBag,
  inventoryWith,
  traderWith,
} from './trade-test-setup';

const GOODS_0 = { list: 'goods', index: 0 } as const;
const whole = (expectedPrice: number) => ({ split: false, expectedPrice });

describe('planBuy from GOODS', () => {
  it('pays the coin price, puts the item into the first free cell and marks the goods cell sold', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const result = planBuy(inventory, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60));
    if (!result.ok) throw new Error(result.reason);
    expect(result).toMatchObject({ key: AXE, amount: 1, price: 60 });
    expect(walletCoins(result.inventory)).toBe(40);
    expect(result.inventory.bag[1]).toMatchObject({ key: AXE, amount: 1, id: 'hero-1:1' });
    expect(result.inventory.idSeq).toBe(2);
    expect(result.trader.goods[0]).toEqual({ key: AXE, amount: 1, sold: true });
    expect(inventory.bag[1]).toBeNull();
  });

  it('buys half a stack with Shift (7 -> 3) and leaves the rest on sale', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const trader = traderWith([[HEALTH_BOTTLE, 7]]);
    const result = planBuy(inventory, trader, GOODS_0, 'auto', { split: true, expectedPrice: 60 });
    if (!result.ok) throw new Error(result.reason);
    expect(result.amount).toBe(3);
    expect(bagAmount(result.inventory, HEALTH_BOTTLE)).toBe(3);
    expect(result.trader.goods[0]).toEqual({ key: HEALTH_BOTTLE, amount: 4 });
  });

  it('merges the bought stack into a stack of the same kind in the bag first', () => {
    const inventory = inventoryWith({ 0: [COINS, 200], 4: [HEALTH_BOTTLE, 2] });
    const result = planBuy(
      inventory,
      traderWith([[HEALTH_BOTTLE, 5]]),
      GOODS_0,
      'auto',
      whole(100),
    );
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[4]).toMatchObject({ key: HEALTH_BOTTLE, amount: 7 });
    expect(result.inventory.bag.filter((cell) => cell?.key === HEALTH_BOTTLE)).toHaveLength(1);
    expect(result.inventory.idSeq).toBe(inventory.idSeq);
  });

  it('puts the item into the chosen bag cell, topping up only what the stack can hold', () => {
    const inventory = inventoryWith({ 0: [COINS, 100], 4: [HEALTH_BOTTLE, 8] });
    const trader = traderWith([[HEALTH_BOTTLE, 5]]);
    const to = { container: 'bag', index: 4 } as const;
    expect(planBuy(inventory, trader, GOODS_0, to, whole(100))).toMatchObject({
      ok: false,
      reason: 'PRICE_CHANGED',
      price: 40,
    });
    const result = planBuy(inventory, trader, GOODS_0, to, whole(40));
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[4]?.amount).toBe(10);
    expect(result.trader.goods[0]).toEqual({ key: HEALTH_BOTTLE, amount: 3 });
  });

  it('refuses a chosen cell taken by another item or by a full stack', () => {
    const inventory = inventoryWith({
      0: [COINS, 500],
      4: [MANA_BOTTLE, 1],
      5: [HEALTH_BOTTLE, 10],
    });
    const trader = traderWith([[HEALTH_BOTTLE, 2]]);
    expect(
      planBuy(inventory, trader, GOODS_0, { container: 'bag', index: 4 }, whole(40)),
    ).toMatchObject({ ok: false, reason: 'SPLIT_TARGET_TAKEN' });
    expect(
      planBuy(inventory, trader, GOODS_0, { container: 'bag', index: 5 }, whole(40)),
    ).toMatchObject({ ok: false, reason: 'STACK_FULL' });
  });

  it('refuses one coin short with the price, and changes nothing', () => {
    const inventory = inventoryWith({ 0: [COINS, 59] });
    const before = structuredClone(inventory);
    const result = planBuy(inventory, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60));
    expect(result).toEqual({ ok: false, reason: 'NOT_ENOUGH_COINS', price: 60 });
    expect(inventory).toEqual(before);
  });

  it('takes coins from the smallest bag stacks first and from the hands last', () => {
    const inventory = inventoryWith(
      { 2: [COINS, 40], 7: [COINS, 10], 9: [COINS, 20] },
      { weapon: [COINS, 100] },
    );
    const result = planBuy(inventory, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60));
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[7]).toBeNull();
    expect(result.inventory.bag[9]).toBeNull();
    expect(result.inventory.bag[2]).toMatchObject({ key: COINS, amount: 10 });
    expect(result.inventory.equip.weapon).toMatchObject({ key: COINS, amount: 100 });
    expect(result.inventory.bag[0]).toMatchObject({ key: AXE });
  });

  it('reaches into the hands only when the bag runs dry', () => {
    const inventory = inventoryWith({ 3: [COINS, 8] }, { shield: [COINS, 70] });
    const result = planBuy(inventory, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60));
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[3]).toBeNull();
    expect(result.inventory.bag[0]).toMatchObject({ key: AXE });
    expect(result.inventory.equip.shield).toMatchObject({ key: COINS, amount: 18 });
  });
});

describe('planBuy from GOODS: refusals and space', () => {
  it('refuses an empty goods cell, a full bag and a purchase that is too heavy', () => {
    const rich = inventoryWith({ 0: [COINS, 1000] });
    expect(planBuy(rich, traderWith([null, [AXE, 1]]), GOODS_0, 'auto', whole(60))).toMatchObject({
      ok: false,
      reason: 'EMPTY_SOURCE',
    });

    const full = fullBag(SWORD);
    full.equip.weapon = mintItem(full, COINS, 100);
    full.capacityKg = 1000;
    expect(planBuy(full, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60))).toMatchObject({
      ok: false,
      reason: 'CONTAINER_FULL',
    });

    const weak = inventoryWith({ 0: [COINS, 500] });
    weak.capacityKg = 0.6;
    expect(planBuy(weak, traderWith([[SWORD, 1]]), GOODS_0, 'auto', whole(500))).toMatchObject({
      ok: false,
      reason: 'OVERWEIGHT',
    });
  });

  it('lets the paid coins free the cell the item lands in', () => {
    const inventory = fullBag(MANA_BOTTLE);
    inventory.bag[10] = mintItem(inventory, COINS, 60);
    const result = planBuy(inventory, traderWith([[AXE, 1]]), GOODS_0, 'auto', whole(60));
    if (!result.ok) throw new Error(result.reason);
    expect(result.inventory.bag[10]).toMatchObject({ key: AXE });
  });
});

describe('planBuy from BUYBACK', () => {
  it('charges the price it was sold for, not the GOODS price', () => {
    const inventory = inventoryWith({ 0: [COINS, 40] });
    const trader = traderWith([[SWORD, 1]], [[HEALTH_BOTTLE, 3, 4]]);
    const result = planBuy(inventory, trader, { list: 'buyback', index: 0 }, 'auto', whole(12));
    if (!result.ok) throw new Error(result.reason);
    expect(walletCoins(result.inventory)).toBe(28);
    expect(bagAmount(result.inventory, HEALTH_BOTTLE)).toBe(3);
    expect(result.trader.buyback.every((cell) => cell === null)).toBe(true);
    expect(result.trader.goods[0]).toEqual({ key: SWORD, amount: 1 });
  });

  it('closes the gap when an older entry is bought back', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const trader = traderWith(
      [],
      [
        [AXE, 1, 19],
        [HEALTH_BOTTLE, 2, 4],
      ],
    );
    const result = planBuy(inventory, trader, { list: 'buyback', index: 0 }, 'auto', whole(19));
    if (!result.ok) throw new Error(result.reason);
    expect(result.trader.buyback[0]).toEqual({ key: HEALTH_BOTTLE, amount: 2, unitPrice: 4 });
    expect(result.trader.buyback[1]).toBeNull();
    expect(result.trader.buyback).toHaveLength(7);
  });
});

describe('planBuy: a bought-out good stays on the shelf as sold', () => {
  it('refuses a sold-out cell as an empty source, so it cannot be bought twice', () => {
    const inventory = inventoryWith({ 0: [COINS, 500] });
    const shelf = traderWith([[AXE, 1]]);
    const first = planBuy(inventory, shelf, GOODS_0, 'auto', whole(60));
    if (!first.ok) throw new Error(first.reason);

    const second = planBuy(
      first.inventory,
      { ...shelf, state: first.trader },
      GOODS_0,
      'auto',
      whole(60),
    );

    expect(second).toMatchObject({ ok: false, reason: 'EMPTY_SOURCE' });
  });

  it('keeps the original stack on a sold-out cell so the shelf can still show what it was', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const result = planBuy(inventory, traderWith([[HEALTH_BOTTLE, 3]]), GOODS_0, 'auto', whole(60));
    if (!result.ok) throw new Error(result.reason);
    expect(result.trader.goods[0]).toEqual({ key: HEALTH_BOTTLE, amount: 3, sold: true });
  });
});

describe('planBuy with an exact amount', () => {
  it('buys exactly the amount asked for (2 of 7) and leaves the rest on sale', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const trader = traderWith([[HEALTH_BOTTLE, 7]]);
    const result = planBuy(inventory, trader, GOODS_0, 'auto', {
      split: false,
      amount: 2,
      expectedPrice: 40,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.amount).toBe(2);
    expect(bagAmount(result.inventory, HEALTH_BOTTLE)).toBe(2);
    expect(result.trader.goods[0]).toEqual({ key: HEALTH_BOTTLE, amount: 5 });
  });

  it('never buys more than the stock holds', () => {
    const inventory = inventoryWith({ 0: [COINS, 100] });
    const trader = traderWith([[HEALTH_BOTTLE, 3]]);
    const result = planBuy(inventory, trader, GOODS_0, 'auto', {
      split: false,
      amount: 50,
      expectedPrice: 60,
    });
    if (!result.ok) throw new Error(result.reason);
    expect(result.amount).toBe(3);
  });
});
