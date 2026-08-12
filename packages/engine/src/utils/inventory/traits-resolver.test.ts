import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../../registry/hexobjects-registry';
import { EHexobjectGroup } from '../../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../../abstraction/inventory-abstraction';
import {
  calculateCarriedWeightKg,
  canFitAdditionalWeight,
  getItemUnitWeightKg,
  mergeItemStacks,
} from './traits-resolver';

function makeItem(overrides: Partial<InventoryItem> & Pick<InventoryItem, 'key' | 'amount'>) {
  return {
    id: 'item-1',
    type: EHexobjectGroup.LOOT,
    slotKey: 'r0c0',
    isNew: false,
    ...overrides,
  };
}

describe('getItemUnitWeightKg', () => {
  it('is zero for the bare hand regardless of content data', () => {
    expect(getItemUnitWeightKg(HEXOBJECT_KEYS.HAND)).toBe(0);
  });

  it('reads the weight declared in content for a real item', () => {
    expect(getItemUnitWeightKg(HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(0.1);
  });
});

describe('calculateCarriedWeightKg', () => {
  it('sums weight across items, scaled by amount', () => {
    const items = [
      makeItem({ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 3 }),
      makeItem({ key: HEXOBJECT_KEYS.COINS, amount: 100 }),
    ];

    expect(calculateCarriedWeightKg(items)).toBeCloseTo(0.1 * 3 + 0.001 * 100);
  });

  it('ignores the bare hand entirely, even if it were given an amount', () => {
    const items = [makeItem({ key: HEXOBJECT_KEYS.HAND, amount: 1 })];

    expect(calculateCarriedWeightKg(items)).toBe(0);
  });

  it('is zero for an empty inventory', () => {
    expect(calculateCarriedWeightKg([])).toBe(0);
  });
});

describe('canFitAdditionalWeight', () => {
  it('accepts weight that stays within capacity', () => {
    expect(canFitAdditionalWeight(3, 10, 5)).toBe(true);
  });

  it('accepts weight that lands exactly on capacity', () => {
    expect(canFitAdditionalWeight(5, 10, 5)).toBe(true);
  });

  it('rejects weight that would exceed capacity', () => {
    expect(canFitAdditionalWeight(8, 10, 5)).toBe(false);
  });
});

describe('mergeItemStacks', () => {
  it('refuses to merge items with different stack keys', () => {
    const target = makeItem({ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 1, stackKey: 'a' });
    const from = makeItem({ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 1, stackKey: 'b' });

    expect(mergeItemStacks(target, from)).toBe(false);
    expect(target.amount).toBe(1);
  });

  it('refuses to merge an item with no stack key at all', () => {
    const target = makeItem({ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 1 });
    const from = makeItem({ key: HEXOBJECT_KEYS.HEALTH_BOTTLE, amount: 1 });

    expect(mergeItemStacks(target, from)).toBe(false);
  });

  it('caps the merge at maxStack, leaving the remainder on `from`', () => {
    const target = makeItem({
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      amount: 8,
      stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    });
    const from = makeItem({
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      amount: 5,
      stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    });

    const merged = mergeItemStacks(target, from);

    expect(merged).toBe(true);
    expect(target.amount).toBe(10);
    expect(from.amount).toBe(3);
  });

  it('refuses to merge into an already-full stack', () => {
    const target = makeItem({
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      amount: 10,
      stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    });
    const from = makeItem({
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      amount: 1,
      stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    });

    expect(mergeItemStacks(target, from)).toBe(false);
    expect(target.amount).toBe(10);
  });

  it('does not zero out `from` when the stack has no maxStack (existing quirk)', () => {
    const target = makeItem({
      key: HEXOBJECT_KEYS.COINS,
      amount: 5,
      stackKey: HEXOBJECT_KEYS.COINS,
    });
    const from = makeItem({
      key: HEXOBJECT_KEYS.COINS,
      amount: 3,
      stackKey: HEXOBJECT_KEYS.COINS,
    });

    const merged = mergeItemStacks(target, from);

    expect(merged).toBe(true);
    expect(target.amount).toBe(8);
    expect(from.amount).toBe(3);
  });
});
