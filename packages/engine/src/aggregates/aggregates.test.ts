import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { CAMP_CHEST_ITEMS } from '../inventory/stash-constants';
import { emptyInventoryState } from '../inventory/inventory-state';
import { countItem } from '../inventory/plan-stock';
import { toAggregate } from '../inventory/inventory-adapter';
import {
  AGGREGATES,
  CAMP_FIRST_CHEST_REWARD,
  PLAYER_COMMAND_AGGREGATES,
  PLAYER_COMMAND_SCHEMAS,
  consumeItemServerSide,
  emptyProgressState,
  executePlayerCommand,
  grantItemServerSide,
  upcastAggregate,
  type PlayerAggregates,
  type PlayerCommand,
  type PlayerCommandContext,
} from './index';

const HERO = 'hero-1';
const CTX: PlayerCommandContext = {
  devGrantAllowed: false,
  inventory: { stashOpen: true, battleOpen: false },
};

function fresh(): PlayerAggregates {
  return { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) };
}

function parse(command: unknown): PlayerCommand {
  const type = (command as { type: keyof typeof PLAYER_COMMAND_SCHEMAS }).type;
  return PLAYER_COMMAND_SCHEMAS[type].parse(command);
}

const claim = (revision: number) =>
  parse({ type: 'CLAIM_CAMP_CHEST', payload: { heroId: HERO, revision } });

describe('aggregate registry', () => {
  it('creates an empty hero: no items, no coins, no chest, no claimed reward', () => {
    const inventory = AGGREGATES.inventory.createInitial({ heroId: HERO });
    const progress = AGGREGATES.progress.createInitial({ heroId: HERO });
    expect(toAggregate(inventory).bag.every((cell) => cell === null)).toBe(true);
    expect(countItem(toAggregate(inventory), HEXOBJECT_KEYS.COINS)).toBe(0);
    expect(inventory.stash.chests).toBe(0);
    expect(progress.claimedRewards).toEqual([]);
    expect(progress.knowledge.current).toBe(20);
    expect(progress.presence).toBeNull();
  });

  it('upcasts a stored v1 document unchanged and refuses unknown fields', () => {
    const stored = { claimedRewards: [CAMP_FIRST_CHEST_REWARD] };
    expect(upcastAggregate('progress', 1, stored, { heroId: HERO })).toEqual({
      ...emptyProgressState(HERO),
      claimedRewards: [CAMP_FIRST_CHEST_REWARD],
    });
    expect(() =>
      upcastAggregate('progress', 1, { ...stored, coins: 99 }, { heroId: HERO }),
    ).toThrow();
    const current = emptyProgressState(HERO);
    expect(
      upcastAggregate('progress', 2, JSON.parse(JSON.stringify(current)), { heroId: HERO }),
    ).toEqual(current);
  });

  it('upcasts a stored v4 progress document with a zero kill count', () => {
    const v4: Partial<ReturnType<typeof emptyProgressState>> = emptyProgressState(HERO);
    delete v4.kills;
    const upcast = upcastAggregate('progress', 4, JSON.parse(JSON.stringify(v4)), { heroId: HERO });
    expect(upcast.kills).toBe(0);
    expect(upcast).toEqual(emptyProgressState(HERO));
  });

  it('keeps inventory v1 valid after a round trip through JSON', () => {
    const inventory = AGGREGATES.inventory.createInitial({ heroId: HERO });
    const stored: unknown = JSON.parse(JSON.stringify(inventory));
    expect(upcastAggregate('inventory', 1, stored, { heroId: HERO })).toEqual(inventory);
  });

  it('throws when a stored version has no upcaster', () => {
    expect(() => upcastAggregate('progress', 0, {}, { heroId: HERO })).toThrow(/No upcaster/);
  });
});

describe('player command schemas', () => {
  it('rejects unknown fields in the envelope-level command and in its payload', () => {
    const ok = { type: 'SORT_STASH', payload: { heroId: HERO, revision: 0 } };
    expect(PLAYER_COMMAND_SCHEMAS.SORT_STASH.safeParse(ok).success).toBe(true);
    expect(PLAYER_COMMAND_SCHEMAS.SORT_STASH.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(
      PLAYER_COMMAND_SCHEMAS.SORT_STASH.safeParse({ ...ok, payload: { ...ok.payload, x: 1 } })
        .success,
    ).toBe(false);
  });

  it('has no client route for GRANT_ITEM / CONSUME_ITEM', () => {
    expect(Object.keys(PLAYER_COMMAND_SCHEMAS)).not.toContain('GRANT_ITEM');
    expect(Object.keys(PLAYER_COMMAND_SCHEMAS)).not.toContain('CONSUME_ITEM');
  });

  it('names the aggregates every command touches, in lock order', () => {
    expect(PLAYER_COMMAND_AGGREGATES.CLAIM_CAMP_CHEST).toEqual(['inventory', 'progress']);
    for (const kinds of Object.values(PLAYER_COMMAND_AGGREGATES)) {
      expect([...kinds]).toEqual([...kinds].sort());
    }
  });
});

describe('CLAIM_CAMP_CHEST', () => {
  it('opens the first chest for free once and fills it with the camp gear', () => {
    const outcome = executePlayerCommand(fresh(), claim(0), CTX);
    if (!outcome.ok) throw new Error(outcome.code);
    const { inventory, progress } = outcome.changed;
    expect(inventory!.stash.chests).toBe(1);
    expect(inventory!.revision).toBe(1);
    expect(inventory!.stash.cells.slice(0, CAMP_CHEST_ITEMS.length).map((c) => c?.key)).toEqual([
      ...CAMP_CHEST_ITEMS,
    ]);
    expect(progress!.claimedRewards).toEqual([CAMP_FIRST_CHEST_REWARD]);
    expect(outcome.events.filter((e) => e.type === 'ITEM_GRANTED')).toHaveLength(
      CAMP_CHEST_ITEMS.length,
    );
    expect(countItem(toAggregate(inventory!), HEXOBJECT_KEYS.COINS)).toBe(0);
  });

  it('cannot be claimed twice, even with a fresh revision', () => {
    const first = executePlayerCommand(fresh(), claim(0), CTX);
    if (!first.ok) throw new Error(first.code);
    const after = { ...fresh(), ...first.changed };
    const again = executePlayerCommand(after, claim(after.inventory.revision), CTX);
    expect(again).toMatchObject({ ok: false, code: 'ALREADY_CLAIMED' });
  });

  it('is refused on a stale revision and changes nothing', () => {
    const state = fresh();
    const before = structuredClone(state);
    expect(executePlayerCommand(state, claim(5), CTX)).toMatchObject({
      ok: false,
      code: 'INVENTORY_STALE',
    });
    expect(state).toEqual(before);
  });

  it('cannot be replaced by buying the first chest', () => {
    const state = fresh();
    const unlock = parse({ type: 'UNLOCK_STASH_CHEST', payload: { heroId: HERO, revision: 0 } });
    expect(executePlayerCommand(state, unlock, CTX)).toMatchObject({
      ok: false,
      code: 'CAMP_CHEST_NOT_CLAIMED',
    });
  });
});

describe('DEV_GRANT_ITEM', () => {
  const dev = parse({
    type: 'DEV_GRANT_ITEM',
    payload: { heroId: HERO, revision: 0, key: HEXOBJECT_KEYS.COINS, amount: 500 },
  });

  it('is forbidden unless the context allows it', () => {
    expect(executePlayerCommand(fresh(), dev, CTX)).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('grants coins as an ordinary item when allowed', () => {
    const outcome = executePlayerCommand(fresh(), dev, { ...CTX, devGrantAllowed: true });
    if (!outcome.ok) throw new Error(outcome.code);
    expect(countItem(toAggregate(outcome.changed.inventory!), HEXOBJECT_KEYS.COINS)).toBe(500);
    expect(outcome.events[0]).toMatchObject({ type: 'ITEM_GRANTED' });
  });

  it('refuses an unknown item key at the schema', () => {
    const bad = {
      type: 'DEV_GRANT_ITEM',
      payload: { heroId: HERO, revision: 0, key: 'x', amount: 1 },
    };
    expect(PLAYER_COMMAND_SCHEMAS.DEV_GRANT_ITEM.safeParse(bad).success).toBe(false);
  });
});

describe('DEV_CONSUME_ITEM', () => {
  const granted = () => {
    const grant = parse({
      type: 'DEV_GRANT_ITEM',
      payload: { heroId: HERO, revision: 0, key: HEXOBJECT_KEYS.COINS, amount: 5 },
    });
    const outcome = executePlayerCommand(fresh(), grant, { ...CTX, devGrantAllowed: true });
    if (!outcome.ok) throw new Error(outcome.code);
    return { ...fresh(), inventory: outcome.changed.inventory! };
  };
  const consume = (revision: number, amount: number) =>
    parse({
      type: 'DEV_CONSUME_ITEM',
      payload: { heroId: HERO, revision, key: HEXOBJECT_KEYS.COINS, amount },
    });

  it('is forbidden unless the context allows it', () => {
    expect(executePlayerCommand(granted(), consume(1, 1), CTX)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('spends what the hero holds and refuses to go below zero', () => {
    const state = granted();
    const ctx = { ...CTX, devGrantAllowed: true };
    const spent = executePlayerCommand(state, consume(1, 3), ctx);
    if (!spent.ok) throw new Error(spent.code);
    expect(countItem(toAggregate(spent.changed.inventory!), HEXOBJECT_KEYS.COINS)).toBe(2);
    expect(executePlayerCommand(state, consume(1, 6), ctx)).toMatchObject({
      ok: false,
      code: 'NOT_ENOUGH',
    });
  });
});

describe('DEV_SET_INVENTORY', () => {
  const ctx = { ...CTX, devGrantAllowed: true };
  const layout = () => {
    const inventory = emptyInventoryState(HERO);
    inventory.bag[0] = {
      id: `${HERO}:0`,
      key: HEXOBJECT_KEYS.COINS,
      type: 'resource' as never,
      stackKey: 'coins',
      amount: 7,
    };
    inventory.idSeq = 1;
    return inventory;
  };
  const command = (revision: number, inventory: unknown) =>
    parse({ type: 'DEV_SET_INVENTORY', payload: { heroId: HERO, revision, inventory } });

  it('is forbidden unless the context allows it', () => {
    expect(executePlayerCommand(fresh(), command(0, layout()), CTX)).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('swaps the whole inventory, moves the revision forward and reports the difference', () => {
    const outcome = executePlayerCommand(fresh(), command(0, layout()), ctx);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.inventory!.revision).toBe(1);
    expect(countItem(toAggregate(outcome.changed.inventory!), HEXOBJECT_KEYS.COINS)).toBe(7);
    expect(outcome.events[0]).toEqual({
      type: 'INVENTORY_REPLACED',
      payload: { heroId: HERO, deltas: [{ key: HEXOBJECT_KEYS.COINS, delta: 7 }] },
    });
  });

  it('keeps the hero id of the account, whatever the sent inventory claims', () => {
    const foreign = { ...layout(), heroId: 'someone-else' };
    const outcome = executePlayerCommand(fresh(), command(0, foreign), ctx);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.changed.inventory!.heroId).toBe(HERO);
  });

  it('refuses a stale revision and a malformed inventory', () => {
    expect(executePlayerCommand(fresh(), command(3, layout()), ctx)).toMatchObject({
      ok: false,
      code: 'INVENTORY_STALE',
    });
    expect(
      PLAYER_COMMAND_SCHEMAS.DEV_SET_INVENTORY.safeParse({
        type: 'DEV_SET_INVENTORY',
        payload: { heroId: HERO, revision: 0, inventory: { bag: [] } },
      }).success,
    ).toBe(false);
  });
});

describe('server-side stock', () => {
  it('grants and then consumes, and refuses to go below zero', () => {
    const granted = grantItemServerSide(
      emptyInventoryState(HERO),
      HEXOBJECT_KEYS.COINS,
      10,
      'reward',
    );
    if (!granted.ok) throw new Error(granted.code);
    const inventory = granted.changed.inventory!;
    const spent = consumeItemServerSide(inventory, HEXOBJECT_KEYS.COINS, 4);
    if (!spent.ok) throw new Error(spent.code);
    expect(countItem(toAggregate(spent.changed.inventory!), HEXOBJECT_KEYS.COINS)).toBe(6);
    expect(consumeItemServerSide(inventory, HEXOBJECT_KEYS.COINS, 11)).toMatchObject({
      ok: false,
      code: 'NOT_ENOUGH',
    });
  });
});
