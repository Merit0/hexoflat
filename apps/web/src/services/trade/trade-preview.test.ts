import { describe, expect, it } from 'vitest';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import { sellUnitPrice } from '@hexoflat/engine/trade/trader-view';
import {
  AXE,
  COINS,
  HEALTH_BOTTLE,
  ILVA,
  SWORD,
  inventoryWith,
  traderWith,
} from '@hexoflat/engine/trade/trade-test-setup';
import { previewBuy, previewRefresh, previewSell } from './trade-preview';

const SWORD_PRICE = coinPriceOf(SWORD)!;
const BOTTLE_PRICE = coinPriceOf(HEALTH_BOTTLE)!;
const GOODS = traderWith([[SWORD, 1], [HEALTH_BOTTLE, 7], null]);
const GOODS_FROM = (index: number) => ({ list: 'goods' as const, index });

describe('previewBuy asks the engine for the price instead of computing it', () => {
  it('gives the price and amount of a whole stack bought into the first free cell', () => {
    const rich = inventoryWith({ 0: [COINS, 5000] });

    expect(previewBuy(rich, GOODS, GOODS_FROM(1), 'auto', false)).toEqual({
      ok: true,
      price: BOTTLE_PRICE * 7,
      amount: 7,
    });
  });

  it('prices half a stack when split', () => {
    const rich = inventoryWith({ 0: [COINS, 5000] });

    expect(previewBuy(rich, GOODS, GOODS_FROM(1), 'auto', true)).toEqual({
      ok: true,
      price: BOTTLE_PRICE * 3,
      amount: 3,
    });
  });

  it('keeps the price on a refusal for missing coins', () => {
    const poor = inventoryWith({ 0: [COINS, SWORD_PRICE - 1] });

    expect(previewBuy(poor, GOODS, GOODS_FROM(0), 'auto', false)).toEqual({
      ok: false,
      reason: 'NOT_ENOUGH_COINS',
      price: SWORD_PRICE,
    });
  });

  it('has no price for an empty goods cell', () => {
    const rich = inventoryWith({ 0: [COINS, 5000] });

    expect(previewBuy(rich, GOODS, GOODS_FROM(2), 'auto', false)).toEqual({
      ok: false,
      reason: 'EMPTY_SOURCE',
      price: null,
    });
  });

  it('refuses a bag cell taken by another item with its price', () => {
    const rich = inventoryWith({ 0: [COINS, 5000], 3: [AXE, 1] });

    expect(previewBuy(rich, GOODS, GOODS_FROM(0), { container: 'bag', index: 3 }, false)).toEqual({
      ok: false,
      reason: 'SPLIT_TARGET_TAKEN',
      price: SWORD_PRICE,
    });
  });
});

describe('previewSell', () => {
  it('gives the payout of a whole stack at the trader rate', () => {
    const bag = inventoryWith({ 2: [HEALTH_BOTTLE, 4] });

    expect(previewSell(bag, GOODS, 2, false)).toEqual({
      ok: true,
      price: sellUnitPrice(ILVA, HEALTH_BOTTLE)! * 4,
      amount: 4,
    });
  });

  it('refuses coins with no price', () => {
    const bag = inventoryWith({ 0: [COINS, 30] });

    expect(previewSell(bag, GOODS, 0, false)).toEqual({
      ok: false,
      reason: 'NOT_TRADEABLE',
      price: null,
    });
  });
});

describe('previewRefresh', () => {
  const state = GOODS.state;

  it('costs the base Will on a new trip and doubles after a paid refresh', () => {
    expect(previewRefresh('ilva', state, 0, 50)).toEqual({ price: 20, affordable: true });
    expect(previewRefresh('ilva', { ...state, paidRefreshes: 1 }, 0, 30)).toEqual({
      price: 40,
      affordable: false,
    });
  });

  it('goes back to the base price after the next cave trip', () => {
    expect(previewRefresh('ilva', { ...state, paidRefreshes: 2 }, 1, 20)).toEqual({
      price: 20,
      affordable: true,
    });
  });
});
