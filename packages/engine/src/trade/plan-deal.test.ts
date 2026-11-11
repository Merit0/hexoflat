import { describe, expect, it } from 'vitest';
import { ILVA, AXE, COINS, HEALTH_BOTTLE, inventoryWith, traderWith } from './trade-test-setup';
import { discountedUnit, applyDiscounts } from './discount-math';
import { planBuy } from './plan-buy';
import { planDeal } from './plan-deal';
import { walletCoins } from './trader-view';
import type { ITraderRef } from './trade-types';

function discounted(percent: number): ITraderRef {
  const trader = traderWith([[AXE, 1]]);
  trader.state.goods[0] = { key: AXE, amount: 1, discountPercent: percent };
  return trader;
}

describe('planDeal', () => {
  it('buys one piece at the discounted price when the guess is exact', () => {
    const result = planDeal(inventoryWith({ 0: [COINS, 100] }), discounted(50), 0, 'auto', 24);
    if (result.kind !== 'bought') throw new Error(result.kind);
    expect(result.result.price).toBe(24);
    expect(result.saved).toBe(24);
    expect(walletCoins(result.result.inventory)).toBe(76);
    expect(result.result.trader.goods[0]).toMatchObject({ sold: true });
  });

  it('wastes the offer on a wrong guess and keeps the coins', () => {
    const result = planDeal(inventoryWith({ 0: [COINS, 100] }), discounted(50), 0, 'auto', 30);
    if (result.kind !== 'wasted') throw new Error(result.kind);
    expect(result.trader.goods[0]).toMatchObject({ key: AXE, wasted: true });
  });

  it('does not waste the offer when the guess is right but coins are short', () => {
    const result = planDeal(inventoryWith({ 0: [COINS, 10] }), discounted(50), 0, 'auto', 24);
    expect(result).toMatchObject({ kind: 'refused', result: { reason: 'NOT_ENOUGH_COINS' } });
  });

  it('refuses a wasted or plain offer', () => {
    const wasted = discounted(50);
    wasted.state.goods[0] = { key: AXE, amount: 1, discountPercent: 50, wasted: true };
    const inventory = inventoryWith({ 0: [COINS, 100] });
    expect(planDeal(inventory, wasted, 0, 'auto', 24)).toMatchObject({ kind: 'refused' });
    expect(planDeal(inventory, traderWith([[AXE, 1]]), 0, 'auto', 24)).toMatchObject({
      kind: 'refused',
      result: { reason: 'NOT_DISCOUNTED' },
    });
  });

  it('refuses a normal purchase of a discounted offer', () => {
    const result = planBuy(
      inventoryWith({ 0: [COINS, 100] }),
      discounted(50),
      { list: 'goods', index: 0 },
      'auto',
      { split: false, expectedPrice: 48 },
    );
    expect(result).toMatchObject({ ok: false, reason: 'NEEDS_DEAL' });
  });
});

describe('discounts', () => {
  it('only offers exact whole-coin discounts', () => {
    expect(discountedUnit(AXE, 50)).toBe(24);
    expect(discountedUnit(AXE, 25)).toBe(36);
    expect(discountedUnit(HEALTH_BOTTLE, 50)).toBe(6);
  });

  it('never discounts more than maxGoods and is deterministic', () => {
    const goods = Array.from({ length: 8 }, () => ({ key: AXE, amount: 1 }));
    const def = { ...ILVA, discounts: { chancePct: 100, percents: [50], maxGoods: 2 } };
    const rolled = applyDiscounts(def, goods, () => 0);
    expect(rolled.filter((good) => good?.discountPercent).length).toBe(2);
  });
});
