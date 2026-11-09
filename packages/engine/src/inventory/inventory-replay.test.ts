import { describe, expect, it } from 'vitest';
import { applyCommand, type HexEngineState } from '../commands/apply-command';
import type { HexEngineCommand } from '../commands/hex-engine-commands';
import { createContext } from '../commands/command-test-context';
import { deserializeState, serializeState } from '../commands/snapshot';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { createInventoryState } from './inventory-state';

const HERO = 'h1';
const bag = (index: number) => ({ container: 'bag' as const, index });

function start(): HexEngineState {
  const map = new HexMapBuilder().name('replay').width(2).height(2).build();
  const inventory = createInventoryState(HERO);
  inventory.capacityKg = 1000;
  inventory.stash.chests = 1;
  return { map, heroes: {}, inventory, inventoryContext: { stashOpen: true, battleOpen: false } };
}

function script(): HexEngineCommand[] {
  const grant = (revision: number, key: string, amount: number): HexEngineCommand => ({
    type: 'GRANT_ITEM',
    payload: { heroId: HERO, revision, key, amount, source: 'pickup' },
  });
  return [
    grant(0, HEXOBJECT_KEYS.HEALTH_BOTTLE, 5),
    grant(1, HEXOBJECT_KEYS.SWORD, 1),
    {
      type: 'MOVE_ITEM',
      payload: { heroId: HERO, revision: 2, from: bag(0), to: bag(3), split: true },
    },
    {
      type: 'CONSUME_ITEM',
      payload: { heroId: HERO, revision: 3, key: HEXOBJECT_KEYS.RETURN_SCROLL, amount: 2 },
    },
    { type: 'STORE_RESOURCES', payload: { heroId: HERO, revision: 4 } },
    { type: 'SORT_STASH', payload: { heroId: HERO, revision: 5 } },
  ];
}

function play(state: HexEngineState, commands: HexEngineCommand[]) {
  return commands.flatMap((command) => applyCommand(state, command, createContext()).events);
}

describe('inventory replay', () => {
  it('replays the same commands to the same inventory and the same events', () => {
    const a = start();
    const b = start();
    const eventsA = play(a, script());
    const eventsB = play(b, script());
    expect(a.inventory).toEqual(b.inventory);
    expect(eventsA).toEqual(eventsB);
    expect(a.inventory!.revision).toBe(6);
  });

  it('gives split stacks ids from idSeq, so ids never depend on the clock or on randomness', () => {
    const state = start();
    play(state, script());
    const ids = [...state.inventory!.bag, ...state.inventory!.stash.cells]
      .filter((cell) => cell !== null)
      .map((cell) => cell.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => /^h1:\d+$/.test(id))).toBe(true);
  });

  it('continues identically from a snapshot taken in the middle', () => {
    const whole = start();
    play(whole, script());

    const first = start();
    const commands = script();
    play(first, commands.slice(0, 3));
    const restored = deserializeState(serializeState(first), 0);
    restored.inventoryContext = first.inventoryContext;
    play(restored, commands.slice(3));

    expect(restored.inventory).toEqual(whole.inventory);
  });
});
