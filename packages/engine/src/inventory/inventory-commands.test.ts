import { describe, expect, it } from 'vitest';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { STASH_CHEST_CELLS } from './stash-constants';

import {
  HERO,
  bag,
  fresh,
  give,
  hand,
  move,
  run,
  stash,
  world,
} from './inventory-command-test-setup';
describe('MOVE_ITEM', () => {
  it('moves an item inside the bag, bumps the revision and emits ITEM_MOVED then INVENTORY_CHANGED', () => {
    const inv = fresh();
    const sword = give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { state, events } = run(world(inv), move(0, bag(0), bag(3)));
    expect(state.inventory!.bag[3]?.id).toBe(sword.id);
    expect(state.inventory!.bag[0]).toBeNull();
    expect(state.inventory!.revision).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['ITEM_MOVED', 'INVENTORY_CHANGED']);
    expect(events[0].payload).toMatchObject({ heroId: HERO, kind: 'move', moved: 1 });
  });

  it('equips into a hand and swaps with what is held', () => {
    const inv = fresh();
    const sword = give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const axe = give(inv, hand('weapon'), HEXOBJECT_KEYS.AXE);
    const { state } = run(world(inv), move(0, bag(0), hand('weapon')));
    expect(state.inventory!.equip.weapon?.id).toBe(sword.id);
    expect(state.inventory!.bag[0]?.id).toBe(axe.id);
  });

  it('refuses a wrong slot with WRONG_SLOT and leaves the state untouched', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.HEALTH_BOTTLE);
    const before = structuredClone(inv);
    const { state, events } = run(
      world(inv),
      move(0, bag(0), { container: 'equip', slot: 'helm' }),
    );
    expect(state.inventory).toEqual(before);
    expect(events).toEqual([
      {
        type: 'ITEM_TRANSFER_REJECTED',
        payload: { heroId: HERO, command: 'MOVE_ITEM', reason: 'WRONG_SLOT' },
      },
    ]);
  });

  it('merges stacks and splits half onto a free cell with a deterministic id', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.HEALTH_BOTTLE, 4);
    inv.idSeq = 7;
    const { state } = run(world(inv), move(0, bag(0), bag(2), true));
    expect(state.inventory!.bag[0]?.amount).toBe(2);
    expect(state.inventory!.bag[2]).toMatchObject({ id: `${HERO}:7`, amount: 2 });
    expect(state.inventory!.idSeq).toBe(8);
  });

  it('does not spend an id when the split is refused', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.HEALTH_BOTTLE, 4);
    give(inv, bag(2), HEXOBJECT_KEYS.SWORD);
    const { state, events } = run(world(inv), move(0, bag(0), bag(2), true));
    expect(state.inventory!.idSeq).toBe(inv.idSeq);
    expect(events[0].type).toBe('ITEM_TRANSFER_REJECTED');
  });

  it('answers a move onto its own cell with a noop: no revision change, no INVENTORY_CHANGED', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { state, events } = run(world(inv), move(0, bag(0), bag(0)));
    expect(state.inventory!.revision).toBe(0);
    expect(events.map((e) => e.type)).toEqual(['ITEM_MOVED']);
    expect(events[0].payload).toMatchObject({ kind: 'noop', moved: 0 });
  });

  it('refuses stash moves while the stash is closed, and moves into an open one', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const closed = run(
      world(inv, { stashOpen: false, battleOpen: false }),
      move(0, bag(0), stash(0)),
    );
    expect(closed.events[0].payload).toMatchObject({ reason: 'STASH_LOCKED' });
    const open = run(world(inv), move(0, bag(0), stash(0)));
    expect(open.state.inventory!.stash.cells[0]?.key).toBe(HEXOBJECT_KEYS.SWORD);
  });

  it('refuses a move into a stash cell of a locked chest', () => {
    const inv = fresh(1);
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { events } = run(world(inv), move(0, bag(0), stash(STASH_CHEST_CELLS)));
    expect(events[0].payload).toMatchObject({ reason: 'INVALID_LOCATION' });
  });

  it('refuses moving from stash to bag when the weight would exceed the capacity', () => {
    const inv = fresh();
    inv.capacityKg = 0.001;
    give(inv, stash(0), HEXOBJECT_KEYS.SWORD);
    const { events } = run(world(inv), move(0, stash(0), bag(0)));
    expect(events[0].payload).toMatchObject({ reason: 'OVERWEIGHT' });
  });

  it('rejects a malformed location through the schema', () => {
    expect(() => run(world(fresh()), move(0, { container: 'bag', index: 999 }, bag(0)))).toThrow();
  });
});

describe('revision, hero and double execution', () => {
  it('rejects a stale revision with INVENTORY_STALE and changes nothing', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const first = run(world(inv), move(0, bag(0), bag(1)));
    const again = run(first.state, move(0, bag(1), bag(2)));
    expect(again.events[0].payload).toMatchObject({ reason: 'INVENTORY_STALE' });
    expect(again.state.inventory!.bag[1]).not.toBeNull();
    expect(again.state.inventory!.revision).toBe(1);
  });

  it('applying the same command twice moves the item once', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const once = run(world(inv), move(0, bag(0), bag(1)));
    const twice = run(once.state, move(0, bag(0), bag(1)));
    expect(twice.state.inventory).toEqual(once.state.inventory);
  });

  it('rejects a command for another hero or a world without inventory', () => {
    const other = run(world(fresh()), {
      type: 'SORT_STASH',
      payload: { heroId: 'someone-else', revision: 0 },
    });
    expect(other.events[0].payload).toMatchObject({ reason: 'NO_INVENTORY' });
    const map = new HexMapBuilder().name('x').width(2).height(2).build();
    const none = run(
      { map, heroes: {} },
      { type: 'SORT_STASH', payload: { heroId: HERO, revision: 0 } },
    );
    expect(none.events[0].payload).toMatchObject({ reason: 'NO_INVENTORY' });
    expect(none.state.inventory).toBeUndefined();
  });
});

describe('hands in a battle', () => {
  it('locks moves that touch a hand with HANDS_LOCKED and still allows the bag', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const battle = world(inv, { stashOpen: true, battleOpen: true });
    const locked = run(battle, move(0, bag(0), hand('weapon')));
    expect(locked.events[0].payload).toMatchObject({ reason: 'HANDS_LOCKED' });
    expect(locked.state.inventory!.equip.weapon).toBeNull();
    const free = run(battle, move(0, bag(0), bag(1)));
    expect(free.state.inventory!.bag[1]).not.toBeNull();
  });

  it('locks auto-placing a held item out of a hand', () => {
    const inv = fresh();
    give(inv, hand('shield'), HEXOBJECT_KEYS.SHIELD);
    const { events } = run(world(inv, { stashOpen: true, battleOpen: true }), {
      type: 'AUTO_PLACE_ITEM',
      payload: {
        heroId: HERO,
        revision: 0,
        from: hand('shield'),
        toContainer: 'bag',
        split: false,
      },
    });
    expect(events[0].payload).toMatchObject({ reason: 'HANDS_LOCKED' });
  });
});

describe('AUTO_PLACE_ITEM', () => {
  it('sends an item to the preferred chest first', () => {
    const inv = fresh(2);
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { state, events } = run(world(inv), {
      type: 'AUTO_PLACE_ITEM',
      payload: {
        heroId: HERO,
        revision: 0,
        from: bag(0),
        toContainer: 'stash',
        split: false,
        preferredChest: 1,
      },
    });
    expect(state.inventory!.stash.cells[STASH_CHEST_CELLS]?.key).toBe(HEXOBJECT_KEYS.SWORD);
    expect(events[0]).toMatchObject({ type: 'ITEM_MOVED', payload: { kind: 'auto' } });
  });

  it('answers NO_CHEST when no chest is bought', () => {
    const inv = fresh(0);
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { events } = run(world(inv), {
      type: 'AUTO_PLACE_ITEM',
      payload: { heroId: HERO, revision: 0, from: bag(0), toContainer: 'stash', split: false },
    });
    expect(events[0].payload).toMatchObject({ reason: 'NO_CHEST' });
  });
});

describe('STORE_RESOURCES and SORT_STASH', () => {
  it('stores resources and consumables, keeps gear in the bag', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    give(inv, bag(1), HEXOBJECT_KEYS.HEALTH_BOTTLE, 2);
    const { state, events } = run(world(inv), {
      type: 'STORE_RESOURCES',
      payload: { heroId: HERO, revision: 0 },
    });
    expect(state.inventory!.bag[0]?.key).toBe(HEXOBJECT_KEYS.SWORD);
    expect(state.inventory!.bag[1]).toBeNull();
    expect(state.inventory!.stash.cells.some((c) => c?.key === HEXOBJECT_KEYS.HEALTH_BOTTLE)).toBe(
      true,
    );
    expect(events.map((e) => e.type)).toEqual(['STASH_RESOURCES_STORED', 'INVENTORY_CHANGED']);
  });

  it('sorts the stash and is a noop the second time', () => {
    const inv = fresh();
    give(inv, stash(5), HEXOBJECT_KEYS.HEALTH_BOTTLE);
    give(inv, stash(9), HEXOBJECT_KEYS.SWORD);
    const first = run(world(inv), { type: 'SORT_STASH', payload: { heroId: HERO, revision: 0 } });
    expect(first.events.map((e) => e.type)).toEqual(['STASH_SORTED', 'INVENTORY_CHANGED']);
    const second = run(first.state, { type: 'SORT_STASH', payload: { heroId: HERO, revision: 1 } });
    expect(second.state.inventory!.revision).toBe(1);
    expect(second.events.map((e) => e.type)).toEqual(['STASH_SORTED']);
  });

  it('refuses both while the stash is closed', () => {
    const closed = world(fresh(), { stashOpen: false, battleOpen: false });
    for (const type of ['STORE_RESOURCES', 'SORT_STASH'] as const) {
      const { events } = run(closed, { type, payload: { heroId: HERO, revision: 0 } });
      expect(events[0].payload).toMatchObject({ reason: 'STASH_LOCKED' });
    }
  });
});
