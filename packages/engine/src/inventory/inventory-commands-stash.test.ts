import { describe, expect, it } from 'vitest';
import type { HexEngineCommand } from '../commands/hex-engine-commands';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getPrototype } from '../content/content-accessors';
import { applyInventoryCommand } from './apply-inventory';
import { toAggregate } from './inventory-adapter';
import { carriedWeightKg } from './item-queries';
import { emptyInventoryState, inventoryStateSchema, type InventoryState } from './inventory-state';

import {
  HERO,
  bag,
  everyItemId,
  fresh,
  give,
  hand,
  move,
  run,
  stash,
  world,
} from './inventory-command-test-setup';
describe('UNLOCK_STASH_CHEST', () => {
  const unlock = (revision: number): HexEngineCommand => ({
    type: 'UNLOCK_STASH_CHEST',
    payload: { heroId: HERO, revision },
  });

  it('pays the price from the coins in a hand and opens the next chest', () => {
    const inv = fresh(1);
    give(inv, hand('weapon'), HEXOBJECT_KEYS.COINS, 130);
    const { state, events } = run(world(inv), unlock(0));
    expect(state.inventory!.stash.chests).toBe(2);
    expect(state.inventory!.equip.weapon?.amount).toBe(30);
    expect(events.map((e) => e.type)).toEqual(['STASH_CHEST_UNLOCKED', 'INVENTORY_CHANGED']);
    expect(events[0].payload).toMatchObject({ chests: 2, price: 100 });
  });

  it('empties the hand when the coins are paid exactly', () => {
    const inv = fresh(1);
    give(inv, hand('shield'), HEXOBJECT_KEYS.COINS, 100);
    expect(run(world(inv), unlock(0)).state.inventory!.equip.shield).toBeNull();
  });

  it('keeps items that wait in a locked chest when another command runs', () => {
    const inv = emptyInventoryState(HERO);
    give(inv, stash(0), HEXOBJECT_KEYS.SWORD);
    give(inv, bag(0), HEXOBJECT_KEYS.AXE);
    const { state } = run(world(inv), move(0, bag(0), bag(1)));
    expect(state.inventory!.stash.cells[0]?.key).toBe(HEXOBJECT_KEYS.SWORD);
  });

  it.each([
    ['the camp chest is not claimed yet', () => fresh(0), 'CAMP_CHEST_NOT_CLAIMED'],
    ['no coins in a hand', () => fresh(1), 'NO_COINS_IN_HAND'],
    [
      'too few coins',
      () => {
        const i = fresh(1);
        give(i, hand('weapon'), HEXOBJECT_KEYS.COINS, 99);
        return i;
      },
      'NOT_ENOUGH_COINS',
    ],
    [
      'coins only in the bag',
      () => {
        const i = fresh(1);
        give(i, bag(0), HEXOBJECT_KEYS.COINS, 500);
        return i;
      },
      'NO_COINS_IN_HAND',
    ],
    [
      'all chests bought',
      () => {
        const i = fresh(5);
        give(i, hand('weapon'), HEXOBJECT_KEYS.COINS, 5000);
        return i;
      },
      'MAX_CHESTS',
    ],
  ])('refuses: %s', (_name, build, reason) => {
    const inv = build();
    const before = structuredClone(inv);
    const { state, events } = run(world(inv), unlock(0));
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ reason });
    expect(state.inventory).toEqual(before);
  });
});

describe('invariants', () => {
  it('keeps every item in exactly one place and the state valid through a run of commands', () => {
    const inv = fresh(2);
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    give(inv, bag(1), HEXOBJECT_KEYS.HEALTH_BOTTLE, 5);
    give(inv, bag(2), HEXOBJECT_KEYS.SHIELD);
    const idsBefore = new Set(everyItemId(inv));
    let state = world(inv);
    const steps: object[] = [
      move(0, bag(1), bag(5), true),
      move(1, bag(0), hand('weapon')),
      { type: 'STORE_RESOURCES', payload: { heroId: HERO, revision: 2 } },
      { type: 'SORT_STASH', payload: { heroId: HERO, revision: 3 } },
      move(4, bag(2), stash(40)),
    ];
    for (const step of steps) state = run(state, step as HexEngineCommand).state;
    const ids = everyItemId(state.inventory!);
    expect(new Set(ids).size).toBe(ids.length);
    const amount = (s: InventoryState) =>
      [...s.bag, ...Object.values(s.equip), ...s.stash.cells].reduce(
        (n, c) => n + (c?.amount ?? 0),
        0,
      );
    expect(amount(state.inventory!)).toBe(amount(inv));
    for (const id of idsBefore) expect(ids).toContain(id);
    expect(inventoryStateSchema.safeParse(state.inventory).success).toBe(true);
  });

  it('never changes its input state or command', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const frozen = structuredClone(inv);
    const result = applyInventoryCommand(inv, {
      type: 'MOVE_ITEM',
      payload: { heroId: HERO, revision: 0, from: bag(0), to: bag(1), split: false },
    });
    expect(inv).toEqual(frozen);
    expect(result.inventory).not.toBe(inv);
  });

  it('matches the old plan rule: same weight accounting as carriedWeightKg', () => {
    const inv = fresh();
    give(inv, bag(0), HEXOBJECT_KEYS.SWORD);
    const { state } = run(world(inv), move(0, bag(0), bag(9)));
    expect(carriedWeightKg(toAggregate(state.inventory!))).toBe(carriedWeightKg(toAggregate(inv)));
    expect(getPrototype(HEXOBJECT_KEYS.SWORD)).toBeDefined();
  });
});
