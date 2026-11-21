import { describe, expect, it } from 'vitest';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { executePlayerCommand, type PlayerAggregates } from './execute-player-command';
import { emptyProgressState } from './progress-state';
import { upcastToken } from '../inventory/upcast-item-tokens';
import { grantWill } from '../knowledge/will';
import { progressStateSchema } from './progress-state';
import { PLAYER_COMMAND_SCHEMAS } from './player-commands';

const HERO = 'hero-1';
const CTX = { devGrantAllowed: true, inventory: { stashOpen: true, battleOpen: false } };

function fresh(): PlayerAggregates {
  return { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) };
}

function replace(state: PlayerAggregates, inventory: InventoryState) {
  return executePlayerCommand(
    state,
    PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.parse({
      type: 'DEV_SET_INVENTORY',
      payload: { heroId: HERO, revision: state.inventory.revision, inventory },
    }),
    CTX,
  );
}

describe('A02 equipment Will characterization', () => {
  it('keeps the base capacity 50 and does not refill Will on an ordinary equipment change', () => {
    const state = fresh();
    state.progress.knowledge.current = 37;
    const inventory = structuredClone(state.inventory);
    inventory.equip.shield = mintItem(inventory, 'shield', 1);
    const outcome = replace(state, inventory);
    if (!outcome.ok) throw new Error(outcome.code);
    const knowledge = (outcome.changed.progress ?? state.progress).knowledge;
    expect(knowledge.current).toBe(37);
    expect(knowledge.capacity).toBe(50);
    expect(outcome.events.some((event) => event.type === 'WILL_GRANTED')).toBe(false);
  });
});

function withBonus(state: PlayerAggregates, bonus: number, equipped = true) {
  const inventory = structuredClone(state.inventory);
  const item = {
    ...mintItem(inventory, 'shield', 1),
    token: {
      ...upcastToken(HERO, 'bag.0', 'shield')!,
      attributes: [{ key: 'will', value: bonus }],
    },
  };
  inventory.equip.shield = equipped ? item : null;
  inventory.bag[0] = equipped ? null : item;
  return inventory;
}

function applied(state: PlayerAggregates, inventory: InventoryState) {
  const outcome = replace(state, inventory);
  if (!outcome.ok) throw new Error(outcome.code);
  return { state: { ...state, ...outcome.changed }, outcome };
}

describe('A02 EA-15/EA-16 equipped Will capacity', () => {
  it.each([25, 50])('raises capacity without refilling a hero at %s Will', (current) => {
    const before = fresh();
    before.progress.knowledge.current = current;
    const { state, outcome } = applied(before, withBonus(before, 5));
    expect(state.progress.knowledge).toMatchObject({ current, capacity: 55, revision: 1 });
    expect(before.progress.knowledge).toMatchObject({ current, capacity: 50, revision: 0 });
    expect(outcome.events).toContainEqual({
      type: 'WILL_CAPACITY_CHANGED',
      payload: {
        heroId: HERO,
        previousCapacity: 50,
        capacity: 55,
        balanceAfter: current,
        revision: 1,
      },
    });
    expect(outcome.events.some((event) => event.type === 'WILL_GRANTED')).toBe(false);
  });

  it('clamps filled bonus Will on removal, persists it and never grants it back on re-equip', () => {
    const before = fresh();
    const on = applied(before, withBonus(before, 5)).state;
    grantWill(on.progress.knowledge, 5, { kind: 'hall', ref: 'test' });
    const off = applied(on, withBonus(on, 5, false));
    expect(off.state.progress.knowledge).toMatchObject({ current: 50, capacity: 50, revision: 2 });
    expect(off.outcome.events).toContainEqual({
      type: 'WILL_SPENT',
      payload: {
        heroId: HERO,
        amount: 5,
        reason: 'equipment',
        ref: 'equipment-capacity',
        balanceAfter: 50,
      },
    });
    const restored = {
      ...off.state,
      progress: progressStateSchema.parse(JSON.parse(JSON.stringify(off.state.progress))),
    };
    const again = applied(restored, withBonus(restored, 5)).state;
    expect(again.progress.knowledge).toMatchObject({ current: 50, capacity: 55, revision: 3 });
  });

  it('ignores bag items, does not bump knowledge for unchanged gear stats and preserves skill/session data', () => {
    const before = fresh();
    before.progress.knowledge.skills = { b_strike: 1 };
    const bagged = applied(before, withBonus(before, 4, false));
    expect(bagged.outcome.changed.progress).toBeUndefined();
    const on = applied(bagged.state, withBonus(bagged.state, 4)).state;
    expect(on.progress.knowledge.skills).toEqual({ b_strike: 1 });
    const unchanged = applied(on, structuredClone(on.inventory));
    expect(unchanged.outcome.changed.progress).toBeUndefined();
    expect(unchanged.outcome.events.some((event) => event.type === 'WILL_CAPACITY_CHANGED')).toBe(
      false,
    );
  });

  it('keeps a low balance when the bonus shrinks', () => {
    const before = fresh();
    before.progress.knowledge.current = 12;
    const on = applied(before, withBonus(before, 5)).state;
    const off = applied(on, withBonus(on, 5, false));
    expect(off.state.progress.knowledge).toMatchObject({ current: 12, capacity: 50 });
    expect(off.outcome.events.some((event) => event.type === 'WILL_SPENT')).toBe(false);
  });
});
