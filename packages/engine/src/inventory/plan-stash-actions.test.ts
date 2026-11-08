import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { carriedWeightKg, planSortStash, planStoreResources } from './item-transfer';
import { aggregate, failure, item, success } from './item-transfer-test-setup';

describe('planStoreResources', () => {
  it('moves resources and consumables to the stash and keeps gear and tools', () => {
    const agg = aggregate({
      bag: {
        0: item(K.HEALTH_BOTTLE, 3),
        1: item(K.COINS, 12),
        2: item(K.SWORD),
        3: item(K.AXE),
      },
    });
    const done = success(planStoreResources(agg, { stashOpen: true }));
    expect(done.kind).toBe('store');
    expect(done.moved).toBe(2);
    expect(done.next.bag.map((cell) => cell?.key ?? null)).toEqual([
      null,
      null,
      K.SWORD,
      K.AXE,
      null,
      null,
    ]);
    expect(done.next.stash.filter(Boolean)).toHaveLength(2);
  });

  it('reports nothing to store when the bag holds only gear and tools', () => {
    const agg = aggregate({ bag: { 0: item(K.SWORD), 1: item(K.AXE) } });
    const done = success(planStoreResources(agg, { stashOpen: true }));
    expect(done.kind).toBe('noop');
    expect(done.moved).toBe(0);
  });

  it('refuses when the stash has no room for any of them', () => {
    const agg = aggregate({
      bag: { 0: item(K.COINS, 3) },
      stash: { 0: item(K.SWORD) },
      stashSize: 1,
    });
    expect(failure(planStoreResources(agg, { stashOpen: true }))).toBe('CONTAINER_FULL');
  });

  it('is locked while the stash is closed', () => {
    expect(failure(planStoreResources(aggregate({}), { stashOpen: false }))).toBe('STASH_LOCKED');
  });
});

describe('planSortStash', () => {
  const messy = () =>
    aggregate({
      stash: {
        0: item(K.COINS, 3, 'coins-a'),
        1: item(K.SWORD, 1, 'sword'),
        3: item(K.RETURN_SCROLL, 2, 'scroll'),
        4: item(K.COINS, 4, 'coins-b'),
        5: item(K.HEALTH_BOTTLE, 6, 'bottle-a'),
        6: item(K.AXE, 1, 'axe'),
        7: item(K.HEALTH_BOTTLE, 7, 'bottle-b'),
      },
      stashSize: 10,
    });

  it('merges stacks and orders by category, then the rarer item first, then by key', () => {
    const done = success(planSortStash(messy(), { stashOpen: true }));
    expect(done.kind).toBe('sort');
    const order = done.next.stash.map((cell) => (cell ? `${cell.key}:${cell.amount}` : null));
    expect(order).toEqual([
      'sword:1',
      'axe:1',
      'return-scroll:2',
      'health-bottle:10',
      'health-bottle:3',
      'coins:7',
      null,
      null,
      null,
      null,
    ]);
  });

  it('is stable: sorting a sorted stash changes nothing', () => {
    const once = success(planSortStash(messy(), { stashOpen: true }));
    const twice = success(planSortStash(once.next, { stashOpen: true }));
    expect(twice.kind).toBe('noop');
    expect(twice.next).toBe(once.next);
  });

  it('keeps the stash out of the carried weight', () => {
    const done = success(planSortStash(messy(), { stashOpen: true }));
    expect(carriedWeightKg(done.next)).toBe(0);
  });

  it('is locked while the stash is closed', () => {
    expect(failure(planSortStash(messy(), { stashOpen: false }))).toBe('STASH_LOCKED');
  });
});
