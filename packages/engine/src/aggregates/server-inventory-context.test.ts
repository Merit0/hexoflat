import { describe, expect, it } from 'vitest';
import { campObjectSpots } from '../content/boards/camp-object-spot';
import { emptyInventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getHexNeighbors } from '../utils/hex-utils';
import {
  PLAYER_COMMAND_SCHEMAS,
  emptyProgressState,
  executePlayerCommand,
  grantItemServerSide,
  serverInventoryContext,
  type PlayerAggregates,
  type PlayerCommand,
  type Presence,
} from './index';

const HERO = 'hero-1';
const [CHEST] = campObjectSpots(HEXOBJECT_KEYS.STASH_CHEST);
const NEAR: Presence = {
  locationKey: 'camping',
  mapId: 'camping-1',
  coordinates: getHexNeighbors(CHEST)[0],
};
const FAR: Presence = {
  ...NEAR,
  coordinates: { columnIndex: CHEST.columnIndex + 2, rowIndex: CHEST.rowIndex },
};

function parse(command: unknown): PlayerCommand {
  const type = (command as { type: keyof typeof PLAYER_COMMAND_SCHEMAS }).type;
  return PLAYER_COMMAND_SCHEMAS[type].parse(command);
}

function heroWithOpenChest(presence: Presence | null): PlayerAggregates {
  const start = { inventory: emptyInventoryState(HERO), progress: emptyProgressState(HERO) };
  const claimed = executePlayerCommand(
    start,
    parse({ type: 'CLAIM_CAMP_CHEST', payload: { heroId: HERO, revision: 0 } }),
    { devGrantAllowed: false, inventory: serverInventoryContext(null) },
  );
  if (!claimed.ok) throw new Error(claimed.code);
  const coins = grantItemServerSide(claimed.changed.inventory!, HEXOBJECT_KEYS.COINS, 150, 'dev');
  if (!coins.ok) throw new Error(coins.code);
  return {
    inventory: coins.changed.inventory!,
    progress: { ...claimed.changed.progress!, presence },
  };
}

function run(state: PlayerAggregates, type: string, payload: Record<string, unknown> = {}) {
  const command = parse({
    type,
    payload: { heroId: HERO, revision: state.inventory.revision, ...payload },
  });
  return executePlayerCommand(state, command, {
    devGrantAllowed: false,
    inventory: serverInventoryContext(state.progress.presence),
  });
}

const coinsCell = (state: PlayerAggregates) =>
  state.inventory.bag.findIndex((cell) => cell?.key === HEXOBJECT_KEYS.COINS);

describe('serverInventoryContext', () => {
  it('opens the stash only for a hero standing next to the camp chest', () => {
    expect(serverInventoryContext(NEAR)).toEqual({ stashOpen: true, battleOpen: false });
    expect(serverInventoryContext(FAR)).toEqual({ stashOpen: false, battleOpen: false });
    expect(serverInventoryContext(null)).toEqual({ stashOpen: false, battleOpen: false });
  });
});

describe('stash commands on the server', () => {
  const takeOut = { from: { container: 'stash', index: 0 }, to: { container: 'bag', index: 0 } };

  it('moves an item out of the stash next to the chest', () => {
    const state = heroWithOpenChest(NEAR);
    const outcome = run(state, 'MOVE_ITEM', { ...takeOut, split: false });
    expect(outcome.ok).toBe(true);
  });

  it.each([
    ['far from the chest', FAR],
    ['with no known place', null],
    ['next to the same hex in the cave', { ...NEAR, locationKey: 'cave' as const }],
  ])('refuses every stash command %s with STASH_LOCKED', (_label, presence) => {
    const state = heroWithOpenChest(presence);
    const before = structuredClone(state);
    const commands: [string, Record<string, unknown>][] = [
      ['MOVE_ITEM', { ...takeOut, split: false }],
      [
        'AUTO_PLACE_ITEM',
        { from: { container: 'bag', index: coinsCell(state) }, toContainer: 'stash', split: false },
      ],
      ['STORE_RESOURCES', {}],
      ['SORT_STASH', {}],
    ];
    for (const [type, payload] of commands) {
      expect(run(state, type, payload)).toMatchObject({ ok: false, code: 'STASH_LOCKED' });
    }
    expect(state).toEqual(before);
  });

  it('still moves things between the bag and the hands anywhere on the map', () => {
    const state = heroWithOpenChest(FAR);
    const outcome = run(state, 'MOVE_ITEM', {
      from: { container: 'bag', index: coinsCell(state) },
      to: { container: 'equip', slot: 'weapon' },
      split: false,
    });
    expect(outcome.ok).toBe(true);
  });
});

describe('UNLOCK_STASH_CHEST on the server', () => {
  function holdingCoins(presence: Presence | null): PlayerAggregates {
    const state = heroWithOpenChest(NEAR);
    const held = run(state, 'MOVE_ITEM', {
      from: { container: 'bag', index: coinsCell(state) },
      to: { container: 'equip', slot: 'weapon' },
      split: false,
    });
    if (!held.ok) throw new Error(held.code);
    return { inventory: held.changed.inventory!, progress: { ...state.progress, presence } };
  }

  it('buys the next chest with the coins in a hand next to the chest', () => {
    const outcome = run(holdingCoins(NEAR), 'UNLOCK_STASH_CHEST');
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.changed.inventory!.stash.chests).toBe(2);
      expect(outcome.changed.inventory!.equip.weapon?.amount).toBe(50);
    }
  });

  it('refuses far from the chest and keeps the coins and the chests', () => {
    const state = holdingCoins(FAR);
    const before = structuredClone(state);
    expect(run(state, 'UNLOCK_STASH_CHEST')).toMatchObject({ ok: false, code: 'STASH_LOCKED' });
    expect(state).toEqual(before);
  });
});
