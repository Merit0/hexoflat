import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { planItemMove } from './item-transfer';
import { aggregate, bag, failure, item, options, stash, success } from './item-transfer-test-setup';

describe('planItemMove stacks, split and weight', () => {
  describe('stacks', () => {
    it('merges up to the stack limit and leaves the rest where it was', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 8, 'from') },
        stash: { 0: item(K.HEALTH_BOTTLE, 5, 'to') },
      });
      const done = success(planItemMove(agg, bag(0), stash(0), options()));
      expect(done.kind).toBe('merge');
      expect(done.next.stash[0]?.amount).toBe(10);
      expect(done.next.bag[0]).toMatchObject({ id: 'from', amount: 3 });
    });

    it('removes the source when the whole stack fits', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 2) },
        stash: { 0: item(K.HEALTH_BOTTLE, 5) },
      });
      const done = success(planItemMove(agg, bag(0), stash(0), options()));
      expect(done.next.bag[0]).toBeNull();
      expect(done.next.stash[0]?.amount).toBe(7);
    });

    it('refuses to merge into a full stack', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 2) },
        stash: { 0: item(K.HEALTH_BOTTLE, 10) },
      });
      expect(failure(planItemMove(agg, bag(0), stash(0), options()))).toBe('STACK_FULL');
    });

    it('stacks without a limit take everything', () => {
      const agg = aggregate({ bag: { 0: item(K.COINS, 40) }, stash: { 0: item(K.COINS, 500) } });
      const done = success(planItemMove(agg, bag(0), stash(0), options()));
      expect(done.next.stash[0]?.amount).toBe(540);
      expect(done.next.bag[0]).toBeNull();
    });

    it('does not merge different kinds, it swaps them', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 2) },
        stash: { 0: item(K.COINS, 5) },
      });
      expect(success(planItemMove(agg, bag(0), stash(0), options())).kind).toBe('swap');
    });
  });

  describe('split', () => {
    it('moves floor(n / 2) of an odd stack to an empty cell', () => {
      const agg = aggregate({ bag: { 0: item(K.HEALTH_BOTTLE, 7, 'stack') } });
      const done = success(planItemMove(agg, bag(0), stash(1), options({ split: true })));
      expect(done.kind).toBe('split');
      expect(done.next.stash[1]).toMatchObject({ id: 'split-1', amount: 3 });
      expect(done.next.bag[0]).toMatchObject({ id: 'stack', amount: 4 });
    });

    it('refuses to split onto a different occupied cell', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 7) },
        stash: { 1: item(K.SWORD) },
      });
      expect(failure(planItemMove(agg, bag(0), stash(1), options({ split: true })))).toBe(
        'SPLIT_TARGET_TAKEN',
      );
    });

    it('lets a merge win over a split on the same stack', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 6) },
        stash: { 0: item(K.HEALTH_BOTTLE, 2) },
      });
      const done = success(planItemMove(agg, bag(0), stash(0), options({ split: true })));
      expect(done.kind).toBe('merge');
      expect(done.next.stash[0]?.amount).toBe(5);
      expect(done.next.bag[0]?.amount).toBe(3);
    });

    it('moves a single item or a non-stackable item whole even with the split key held', () => {
      const agg = aggregate({
        bag: { 0: item(K.HEALTH_BOTTLE, 1), 1: item(K.SWORD) },
      });
      expect(success(planItemMove(agg, bag(0), stash(0), options({ split: true }))).kind).toBe(
        'move',
      );
      expect(success(planItemMove(agg, bag(1), stash(1), options({ split: true }))).kind).toBe(
        'move',
      );
    });
  });
});
