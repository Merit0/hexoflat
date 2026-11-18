import { sampleToken } from '../tokens/token-test-setup';
import { describe, expect, it } from 'vitest';
import { emptyInventoryState, mintItem } from '../inventory/inventory-state';
import { toAggregate } from '../inventory/inventory-adapter';
import { carriedWeightKg } from '../inventory/item-queries';
import type { IInventoryDraft } from '../inventory/apply-stock';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { pickupStack } from './pickup-stack';

describe('pickup carrying weight', () => {
  it('reports overweight atomically and allows a second sword when capacity permits', () => {
    const inventory = emptyInventoryState('hero');
    inventory.bag[0] = mintItem(inventory, HEXOBJECT_KEYS.SWORD, 1);
    inventory.capacityKg = carriedWeightKg(toAggregate(inventory)) + 0.1;
    const bag: IInventoryDraft = { current: inventory, events: [] };
    const stacks = [{ itemKey: HEXOBJECT_KEYS.SWORD, amount: 1, token: sampleToken() }];
    const input = { stacks, isTarget: () => true, adjacent: true, bag };
    expect(pickupStack(input)).toEqual({ ok: false, reason: 'OVERWEIGHT' });
    expect(bag.current).toBe(inventory);
    expect(bag.events).toEqual([]);
    expect(stacks).toHaveLength(1);
    inventory.capacityKg = 100;
    expect(pickupStack(input).ok).toBe(true);
    expect(bag.current?.bag.filter((item) => item?.key === HEXOBJECT_KEYS.SWORD)).toHaveLength(2);
  });
});
