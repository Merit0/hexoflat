import { describe, expect, it } from 'vitest';
import { getMeta } from '../content/content-accessors';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { toAggregate } from './inventory-adapter';
import { emptyInventoryState, mintItem } from './inventory-state';
import { countItem, planConsume, planGrant } from './plan-stock';

const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;
const SWORD = HEXOBJECT_KEYS.SWORD;
const maxPotions = getMeta(POTION)?.traits?.maxStack ?? 99;

function agg(prepare: (inv: ReturnType<typeof emptyInventoryState>) => void = () => {}) {
  const inv = emptyInventoryState('h1');
  inv.capacityKg = 1000;
  prepare(inv);
  return toAggregate(inv);
}

function ids() {
  let n = 0;
  return () => `new-${n++}`;
}

describe('planGrant', () => {
  it('puts a new item into the first free bag cell', () => {
    const result = planGrant(agg(), SWORD, 1, 1000, ids());
    expect(result).toMatchObject({ ok: true, placedAt: [{ container: 'bag', index: 0 }] });
    if (result.ok) expect(result.next.bag[0]).toMatchObject({ key: SWORD, amount: 1, id: 'new-0' });
  });

  it('tops up an unfinished stack, then spills into the next free cell', () => {
    const start = agg((inv) => {
      inv.bag[0] = mintItem(inv, POTION, maxPotions - 1);
    });
    const result = planGrant(start, POTION, 3, 1000, ids());
    if (!result.ok) throw new Error('grant refused');
    expect(result.next.bag[0]?.amount).toBe(maxPotions);
    expect(result.next.bag[1]?.amount).toBe(2);
    expect(countItem(result.next, POTION)).toBe(maxPotions + 2);
  });

  it('tops up a stack held in a hand (coins in hand stay together)', () => {
    const start = agg((inv) => {
      inv.equip.weapon = mintItem(inv, HEXOBJECT_KEYS.COINS, 5);
    });
    const result = planGrant(start, HEXOBJECT_KEYS.COINS, 20, 1000, ids());
    if (!result.ok) throw new Error('grant refused');
    expect(result.next.equip.weapon?.amount).toBe(25);
    expect(result.placedAt).toEqual([{ container: 'equip', slot: 'weapon' }]);
  });

  it('refuses an item that is too heavy and changes nothing', () => {
    const start = agg();
    expect(planGrant(start, SWORD, 1, 0.001, ids())).toEqual({ ok: false, reason: 'TOO_HEAVY' });
  });

  it('is atomic: a full bag leaves the half-filled stack alone', () => {
    const start = agg((inv) => {
      inv.bag.forEach((_, i) => {
        inv.bag[i] = mintItem(inv, SWORD, 1);
      });
      inv.bag[0] = mintItem(inv, POTION, maxPotions - 1);
    });
    const result = planGrant(start, POTION, 5, 1000, ids());
    expect(result).toEqual({ ok: false, reason: 'BAG_FULL' });
    expect(start.bag[0]?.amount).toBe(maxPotions - 1);
  });

  it('places a non-stackable item one piece per cell', () => {
    const result = planGrant(agg(), SWORD, 3, 1000, ids());
    if (!result.ok) throw new Error('grant refused');
    expect(result.next.bag.filter((c) => c?.key === SWORD)).toHaveLength(3);
  });

  it('refuses the hand and an unknown key', () => {
    expect(planGrant(agg(), HEXOBJECT_KEYS.HAND, 1, 1000, ids())).toEqual({
      ok: false,
      reason: 'NOT_STORABLE',
    });
    expect(planGrant(agg(), 'ghost' as never, 1, 1000, ids())).toEqual({
      ok: false,
      reason: 'UNKNOWN_ITEM',
    });
  });

  it('does not change its input', () => {
    const start = agg();
    const before = JSON.stringify(start);
    planGrant(start, SWORD, 2, 1000, ids());
    expect(JSON.stringify(start)).toBe(before);
  });
});

describe('planConsume', () => {
  it('takes from the bag first and then from a hand, emptying cells that run out', () => {
    const start = agg((inv) => {
      inv.bag[2] = mintItem(inv, POTION, 2);
      inv.equip.shield = mintItem(inv, POTION, 3);
    });
    const result = planConsume(start, POTION, 4);
    if (!result.ok) throw new Error('consume refused');
    expect(result.next.bag[2]).toBeNull();
    expect(result.next.equip.shield?.amount).toBe(1);
  });

  it('removes the stack when the last piece goes', () => {
    const start = agg((inv) => {
      inv.equip.weapon = mintItem(inv, POTION, 1);
    });
    const result = planConsume(start, POTION, 1);
    if (!result.ok) throw new Error('consume refused');
    expect(result.next.equip.weapon).toBeNull();
  });

  it('refuses to overdraw and changes nothing', () => {
    const start = agg((inv) => {
      inv.bag[0] = mintItem(inv, POTION, 1);
    });
    expect(planConsume(start, POTION, 2)).toEqual({ ok: false, reason: 'NOT_ENOUGH' });
    expect(countItem(start, POTION)).toBe(1);
  });

  it('never counts the stash', () => {
    const start = agg((inv) => {
      inv.stash.chests = 1;
      inv.stash.cells[0] = mintItem(inv, POTION, 5);
    });
    expect(countItem(start, POTION)).toBe(0);
  });
});
