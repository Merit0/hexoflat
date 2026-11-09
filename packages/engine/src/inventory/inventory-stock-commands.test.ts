import { describe, expect, it } from 'vitest';
import { applyCommand, type HexEngineState } from '../commands/apply-command';
import type { HexEngineCommand } from '../commands/hex-engine-commands';
import { createContext } from '../commands/command-test-context';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HexMapBuilder } from '../map/builders/hex-map-builder';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { toAggregate } from './inventory-adapter';
import { emptyInventoryState, mintItem, type InventoryState } from './inventory-state';
import { countItem } from './plan-stock';

const HERO = 'h1';
const POTION = HEXOBJECT_KEYS.HEALTH_BOTTLE;

function world(inventory?: InventoryState): HexEngineState {
  const map = new HexMapBuilder().name('stock').width(2).height(2).build();
  return { map, heroes: {}, inventory };
}

function run(state: HexEngineState, command: HexEngineCommand) {
  return applyCommand(state, command, createContext());
}

const grant = (revision: number, amount = 1, key: string = POTION): HexEngineCommand => ({
  type: 'GRANT_ITEM',
  payload: { heroId: HERO, revision, key, amount, source: 'dev' },
});
const consume = (revision: number, amount = 1): HexEngineCommand => ({
  type: 'CONSUME_ITEM',
  payload: { heroId: HERO, revision, key: POTION, amount },
});

describe('GRANT_ITEM / CONSUME_ITEM', () => {
  it('grants an item, bumps the revision and reports where it landed', () => {
    const { state, events } = run(world(emptyInventoryState(HERO)), grant(0, 2));
    expect(countItem(toAggregate(state.inventory!), POTION)).toBe(2);
    expect(state.inventory!.revision).toBe(1);
    expect(events.map((e) => e.type)).toEqual(['ITEM_GRANTED', 'INVENTORY_CHANGED']);
    expect(events[0].payload).toMatchObject({
      heroId: HERO,
      key: POTION,
      amount: 2,
      source: 'dev',
      placedAt: [{ container: 'bag', index: 0 }],
    });
  });

  it('gives new stacks deterministic ids from idSeq', () => {
    const inv = emptyInventoryState(HERO);
    inv.idSeq = 4;
    const { state } = run(world(inv), grant(0, 1, HEXOBJECT_KEYS.SWORD));
    expect(state.inventory!.bag[0]?.id).toBe(`${HERO}:4`);
    expect(state.inventory!.idSeq).toBe(5);
  });

  it('rejects a stale revision, a missing inventory and a refused grant without changes', () => {
    const inv = emptyInventoryState(HERO);
    const stale = run(world(inv), grant(3));
    expect(stale.events[0]).toMatchObject({
      type: 'ITEM_GRANT_REJECTED',
      payload: { reason: 'INVENTORY_STALE' },
    });
    expect(stale.state.inventory).toEqual(inv);

    const none = run(world(), grant(0));
    expect(none.events[0].payload).toMatchObject({ reason: 'NO_INVENTORY' });
    expect(none.state.inventory).toBeUndefined();

    const heavy = emptyInventoryState(HERO);
    heavy.capacityKg = 0.001;
    const refused = run(world(heavy), grant(0, 1, HEXOBJECT_KEYS.SWORD));
    expect(refused.events[0].payload).toMatchObject({ reason: 'TOO_HEAVY' });
    expect(refused.state.inventory).toEqual(heavy);
  });

  it('rejects the hand and unknown keys at the schema', () => {
    expect(() => run(world(emptyInventoryState(HERO)), grant(0, 1, 'hand'))).toThrow();
    expect(() => run(world(emptyInventoryState(HERO)), grant(0, 1, 'ghost'))).toThrow();
  });

  it('consumes, then refuses to overdraw', () => {
    const inv = emptyInventoryState(HERO);
    inv.bag[0] = mintItem(inv, POTION, 2);
    const first = run(world(inv), consume(0, 2));
    expect(first.state.inventory!.bag[0]).toBeNull();
    expect(first.events.map((e) => e.type)).toEqual(['ITEM_CONSUMED', 'INVENTORY_CHANGED']);
    const second = run(first.state, consume(1, 1));
    expect(second.events[0]).toMatchObject({
      type: 'ITEM_CONSUME_REJECTED',
      payload: { reason: 'NOT_ENOUGH' },
    });
    expect(second.state.inventory!.revision).toBe(1);
  });
});

describe('picking up from the map (TAKE finisher)', () => {
  function withPendingTake(inventory?: InventoryState) {
    const state = world(inventory);
    const tile = state.map.tiles[0];
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.SWORD, tile.coordinates);
    tile.pendingAction = {
      type: EHexActionType.TAKE,
      startedAt: 0,
      endsAt: 0,
      hexobjectKey: HEXOBJECT_KEYS.SWORD,
    };
    return { state, tile };
  }
  const tick: HexEngineCommand = { type: 'WORLD_TICK', payload: { now: 10 } };

  it('moves the object into the bag and reports ITEM_GRANTED with source pickup', () => {
    const { state, tile } = withPendingTake(emptyInventoryState(HERO));
    const result = run(state, tick);
    expect(tile.hexobject).toBeNull();
    expect(result.state.inventory!.bag[0]?.key).toBe(HEXOBJECT_KEYS.SWORD);
    expect(result.events.map((e) => e.type)).toEqual([
      'WORLD_TICKED',
      'ITEM_GRANTED',
      'INVENTORY_CHANGED',
    ]);
    expect(result.events[1].payload).toMatchObject({ source: 'pickup' });
  });

  it('leaves the object on the map when the bag is full', () => {
    const inv = emptyInventoryState(HERO);
    inv.bag.forEach((_, i) => {
      inv.bag[i] = mintItem(inv, HEXOBJECT_KEYS.AXE, 1);
    });
    const { state, tile } = withPendingTake(inv);
    const result = run(state, tick);
    expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.SWORD);
    expect(result.events.some((e) => e.type === 'ITEM_GRANT_REJECTED')).toBe(true);
    expect(result.state.inventory).toEqual(inv);
  });

  it('leaves the object alone when the state has no inventory', () => {
    const { state, tile } = withPendingTake();
    run(state, tick);
    expect(tile.hexobject?.hexobjectKey).toBe(HEXOBJECT_KEYS.SWORD);
    expect(state.inventory).toBeUndefined();
  });
});
