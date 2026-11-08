import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { planItemAutoPlace } from './item-transfer';
import {
  aggregate,
  bag,
  equip,
  failure,
  item,
  options,
  stash,
  success,
} from './item-transfer-test-setup';

describe('planItemAutoPlace', () => {
  it('tops up unfinished stacks before taking a free cell', () => {
    const agg = aggregate({
      bag: { 0: item(K.HEALTH_BOTTLE, 8, 'carried') },
      stash: { 0: item(K.HEALTH_BOTTLE, 7), 1: item(K.SWORD) },
    });
    const done = success(planItemAutoPlace(agg, bag(0), 'stash', options()));
    expect(done.kind).toBe('auto');
    expect(done.next.stash[0]?.amount).toBe(10);
    expect(done.next.stash[2]).toMatchObject({ id: 'carried', amount: 5 });
    expect(done.next.bag[0]).toBeNull();
  });

  it('takes the first empty cell for a new kind', () => {
    const agg = aggregate({ bag: { 2: item(K.SWORD, 1, 'sword') }, stash: { 0: item(K.AXE) } });
    const done = success(planItemAutoPlace(agg, bag(2), 'stash', options()));
    expect(done.next.stash[1]?.id).toBe('sword');
  });

  it('sends half of a stack with the split key and keeps the rest', () => {
    const agg = aggregate({ bag: { 0: item(K.HEALTH_BOTTLE, 7) } });
    const done = success(planItemAutoPlace(agg, bag(0), 'stash', options({ split: true })));
    expect(done.next.stash[0]).toMatchObject({ amount: 3 });
    expect(done.next.bag[0]).toMatchObject({ amount: 4 });
  });

  it('sends a worn item to the stash', () => {
    const agg = aggregate({ worn: { weapon: item(K.SWORD, 1, 'sword') } });
    const done = success(planItemAutoPlace(agg, equip('weapon'), 'stash', options()));
    expect(done.next.equip.weapon).toBeNull();
    expect(done.next.stash[0]?.id).toBe('sword');
  });

  it('refuses when the container has no room, all or nothing', () => {
    const full = aggregate({
      bag: { 0: item(K.HEALTH_BOTTLE, 6) },
      stash: { 0: item(K.HEALTH_BOTTLE, 7), 1: item(K.SWORD), 2: item(K.AXE) },
      stashSize: 3,
    });
    expect(failure(planItemAutoPlace(full, bag(0), 'stash', options()))).toBe('CONTAINER_FULL');
  });

  it('is locked with the stash and refuses when the load would grow too much', () => {
    const agg = aggregate({ bag: { 0: item(K.PICKAXE) }, stash: { 0: item(K.SWORD) } });
    expect(failure(planItemAutoPlace(agg, bag(0), 'stash', options({ stashOpen: false })))).toBe(
      'STASH_LOCKED',
    );
    expect(failure(planItemAutoPlace(agg, stash(0), 'bag', options({ capacityKg: 2 })))).toBe(
      'OVERWEIGHT',
    );
  });

  it('does nothing when the item already lives in the target container', () => {
    const agg = aggregate({ bag: { 0: item(K.SWORD) } });
    expect(success(planItemAutoPlace(agg, bag(0), 'bag', options())).kind).toBe('noop');
  });
});
