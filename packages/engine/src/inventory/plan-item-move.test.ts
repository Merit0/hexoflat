import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS as K } from '../registry/hexobjects-registry';
import { planItemMove } from './item-transfer';
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

describe('planItemMove', () => {
  it('moves an item into an empty cell of another container', () => {
    const agg = aggregate({ bag: { 0: item(K.SWORD, 1, 'sword') } });
    const done = success(planItemMove(agg, bag(0), stash(2), options()));
    expect(done.kind).toBe('move');
    expect(done.next.bag[0]).toBeNull();
    expect(done.next.stash[2]?.id).toBe('sword');
  });

  it('does nothing when the item is dropped on its own cell', () => {
    const agg = aggregate({ bag: { 0: item(K.SWORD) } });
    const done = success(planItemMove(agg, bag(0), bag(0), options()));
    expect(done.kind).toBe('noop');
    expect(done.next).toBe(agg);
  });

  it('refuses addresses that do not exist and empty sources', () => {
    const agg = aggregate({ bag: { 0: item(K.SWORD) } });
    expect(failure(planItemMove(agg, bag(99), bag(1), options()))).toBe('INVALID_LOCATION');
    expect(failure(planItemMove(agg, bag(0), stash(-1), options()))).toBe('INVALID_LOCATION');
    expect(failure(planItemMove(agg, bag(3), bag(1), options()))).toBe('EMPTY_SOURCE');
  });

  describe('stash lock', () => {
    it('refuses to move into or out of the stash while it is closed', () => {
      const agg = aggregate({ bag: { 0: item(K.SWORD) }, stash: { 0: item(K.AXE) } });
      const closed = options({ stashOpen: false });
      expect(failure(planItemMove(agg, bag(0), stash(1), closed))).toBe('STASH_LOCKED');
      expect(failure(planItemMove(agg, stash(0), bag(1), closed))).toBe('STASH_LOCKED');
      expect(success(planItemMove(agg, bag(0), bag(1), closed)).kind).toBe('move');
    });
  });

  describe('equipment slots', () => {
    it('equips a fitting item and reports it as equip', () => {
      const agg = aggregate({ bag: { 0: item(K.SHIELD) } });
      const done = success(planItemMove(agg, bag(0), equip('shield'), options()));
      expect(done.kind).toBe('equip');
      expect(done.next.equip.shield?.key).toBe(K.SHIELD);
    });

    it('refuses an item that does not fit the slot', () => {
      const agg = aggregate({ bag: { 0: item(K.SHIELD), 1: item(K.HEALTH_BOTTLE) } });
      expect(failure(planItemMove(agg, bag(0), equip('weapon'), options()))).toBe('WRONG_SLOT');
      expect(failure(planItemMove(agg, bag(1), equip('armor'), options()))).toBe('WRONG_SLOT');
    });

    it('keeps letting a usable item and a tool into a hand slot', () => {
      const agg = aggregate({ bag: { 0: item(K.AXE), 1: item(K.HEALTH_BOTTLE) } });
      expect(success(planItemMove(agg, bag(0), equip('weapon'), options())).kind).toBe('equip');
      expect(success(planItemMove(agg, bag(1), equip('shield'), options())).kind).toBe('equip');
    });

    it('swaps with the worn item when it fits the source slot', () => {
      const agg = aggregate({
        bag: { 0: item(K.SWORD, 1, 'sword') },
        worn: { weapon: item(K.AXE, 1, 'axe') },
      });
      const done = success(planItemMove(agg, bag(0), equip('weapon'), options()));
      expect(done.kind).toBe('swap');
      expect(done.next.equip.weapon?.id).toBe('sword');
      expect(done.next.bag[0]?.id).toBe('axe');
    });

    it('refuses a swap that would put a wrong item back into the slot', () => {
      const agg = aggregate({ bag: { 0: item(K.SHIELD) }, worn: { weapon: item(K.SWORD) } });
      expect(failure(planItemMove(agg, equip('weapon'), bag(0), options()))).toBe(
        'SWAP_WRONG_SLOT',
      );
    });

    it('takes a worn item off into an empty cell', () => {
      const agg = aggregate({ worn: { weapon: item(K.SWORD, 1, 'sword') } });
      const done = success(planItemMove(agg, equip('weapon'), stash(0), options()));
      expect(done.next.equip.weapon).toBeNull();
      expect(done.next.stash[0]?.id).toBe('sword');
    });
  });
});
