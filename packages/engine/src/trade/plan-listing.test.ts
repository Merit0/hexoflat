import { describe, expect, it } from 'vitest';
import { emptyListings } from './listing-state';
import { planList, planReprice, planUnlist } from './plan-listing';
import { AXE, COINS, HEALTH_BOTTLE, bagAmount, fullBag, inventoryWith } from './trade-test-setup';

describe('planList', () => {
  it('lifts the whole stack out of the bag into the first free slot at the unit price', () => {
    const inventory = inventoryWith({ 0: [COINS, 10], 1: [HEALTH_BOTTLE, 3] });
    const result = planList(inventory, emptyListings(), 1, 14);
    if (!result.ok) throw new Error(result.reason);
    expect(result.listings[0]).toEqual({ key: HEALTH_BOTTLE, amount: 3, unitPrice: 14 });
    expect(result.listings.slice(1).every((cell) => cell === null)).toBe(true);
    expect(result.inventory.bag[1]).toBeNull();
    expect(bagAmount(result.inventory, COINS)).toBe(10);
  });

  it('lists only the asked amount and keeps the rest in the bag', () => {
    const inventory = inventoryWith({ 1: [HEALTH_BOTTLE, 5] });
    const result = planList(inventory, emptyListings(), 1, 10, 2);
    if (!result.ok) throw new Error(result.reason);
    expect(result.listings[0]).toMatchObject({ amount: 2 });
    expect(bagAmount(result.inventory, HEALTH_BOTTLE)).toBe(3);
  });

  it('refuses coins, an empty cell, a bad price and a full set of slots', () => {
    const inventory = inventoryWith({ 0: [COINS, 10], 1: [AXE, 1] });
    expect(planList(inventory, emptyListings(), 0, 10)).toEqual({
      ok: false,
      reason: 'NOT_TRADEABLE',
    });
    expect(planList(inventory, emptyListings(), 5, 10)).toEqual({
      ok: false,
      reason: 'EMPTY_SOURCE',
    });
    expect(planList(inventory, emptyListings(), 1, 0)).toEqual({ ok: false, reason: 'BAD_PRICE' });
    expect(planList(inventory, emptyListings(), 1, 1000)).toEqual({
      ok: false,
      reason: 'BAD_PRICE',
    });
    const taken = emptyListings().map(() => ({ key: AXE, amount: 1, unitPrice: 5 }));
    expect(planList(inventory, taken, 1, 10)).toEqual({ ok: false, reason: 'TRADE_SLOTS_FULL' });
  });
});

describe('planUnlist', () => {
  const listed = () => {
    const listings = emptyListings();
    listings[2] = { key: HEALTH_BOTTLE, amount: 4, unitPrice: 9 };
    return listings;
  };

  it('puts the whole slot back into the bag and empties it', () => {
    const result = planUnlist(inventoryWith({ 0: [COINS, 5] }), listed(), 2);
    if (!result.ok) throw new Error(result.reason);
    expect(bagAmount(result.inventory, HEALTH_BOTTLE)).toBe(4);
    expect(result.listings[2]).toBeNull();
  });

  it('refuses an empty slot, a full bag and a load that is too heavy', () => {
    expect(planUnlist(inventoryWith({}), emptyListings(), 0)).toEqual({
      ok: false,
      reason: 'EMPTY_SOURCE',
    });
    expect(planUnlist(fullBag(AXE), listed(), 2)).toEqual({ ok: false, reason: 'CONTAINER_FULL' });
    const weak = inventoryWith({});
    weak.capacityKg = 0.1;
    expect(planUnlist(weak, listed(), 2)).toEqual({ ok: false, reason: 'OVERWEIGHT' });
  });
});

describe('planReprice', () => {
  it('changes only the unit price of a filled slot', () => {
    const listings = emptyListings();
    listings[0] = { key: AXE, amount: 1, unitPrice: 30 };
    const result = planReprice(listings, 0, 35);
    if (!result.ok) throw new Error(result.reason);
    expect(result.listings[0]).toEqual({ key: AXE, amount: 1, unitPrice: 35 });
    expect(planReprice(listings, 1, 35)).toEqual({ ok: false, reason: 'EMPTY_SOURCE' });
    expect(planReprice(listings, 0, 0)).toEqual({ ok: false, reason: 'BAD_PRICE' });
  });
});
