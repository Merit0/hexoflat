import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { carriedWeightKg, planItemMove } from './item-transfer';
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

describe('planItemMove weight and purity', () => {
  describe('weight', () => {
    it('refuses to grow the load past the capacity and leaves the state alone', () => {
      const agg = aggregate({
        bag: { 0: item(K.PICKAXE), 1: item(K.AXE) },
        stash: { 0: item(K.SWORD) },
      });
      expect(failure(planItemMove(agg, stash(0), bag(2), options({ capacityKg: 3 })))).toBe(
        'OVERWEIGHT',
      );
    });

    it('lets the load shrink while overweight', () => {
      const agg = aggregate({ bag: { 0: item(K.PICKAXE), 1: item(K.SWORD), 2: item(K.SHIELD) } });
      const heavy = options({ capacityKg: 3 });
      expect(carriedWeightKg(agg)).toBeGreaterThan(3);
      expect(success(planItemMove(agg, bag(2), stash(0), heavy)).kind).toBe('move');
      expect(success(planItemMove(agg, bag(0), bag(3), heavy)).kind).toBe('move');
    });

    it('counts the bag and the worn items but never the stash', () => {
      const agg = aggregate({
        bag: { 0: item(K.AXE) },
        worn: { weapon: item(K.SWORD) },
        stash: { 0: item(K.SHIELD), 1: item(K.PICKAXE) },
      });
      expect(carriedWeightKg(agg)).toBeCloseTo(2.8);
    });

    it('lets equipping an item from the bag through, the load does not change', () => {
      const agg = aggregate({ bag: { 0: item(K.SHIELD) } });
      expect(
        success(planItemMove(agg, bag(0), equip('shield'), options({ capacityKg: 1 }))).kind,
      ).toBe('equip');
    });
  });

  it('never mutates the aggregate it was given', () => {
    const agg = aggregate({
      bag: { 0: item(K.HEALTH_BOTTLE, 7) },
      stash: { 0: item(K.HEALTH_BOTTLE, 5) },
    });
    const before = JSON.stringify(agg);
    planItemMove(agg, bag(0), stash(0), options({ split: true }));
    planItemMove(agg, bag(0), stash(3), options({ split: true }));
    expect(JSON.stringify(agg)).toBe(before);
  });
});
