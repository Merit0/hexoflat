import { beforeEach, describe, expect, it } from 'vitest';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import type { Presence, ProgressState } from '@hexoflat/engine';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import type { PlayerEnvelope } from '@/services/player/player-socket';
import {
  FAKE_RNG_SEED,
  fakePlayerSocketModule,
  resetFakePlayerServer,
  snapshot,
} from './fake-player-server';

const HERO = 'hero-1';
const [CHEST] = campObjectSpots(K.STASH_CHEST);
const NEAR: Presence = {
  locationKey: 'camping',
  mapId: 'camping-1',
  coordinates: getHexNeighbors(CHEST)[0],
};
const FAR: Presence = {
  ...NEAR,
  coordinates: { columnIndex: CHEST.columnIndex + 2, rowIndex: CHEST.rowIndex },
};

const { PlayerSocket } = fakePlayerSocketModule();
const socket = new PlayerSocket();

function inventoryCommand(type: string, payload: Record<string, unknown> = {}) {
  const revision = snapshot().aggregates.inventory!.revision;
  const envelope: PlayerEnvelope = {
    commandId: crypto.randomUUID(),
    heroId: HERO,
    aggregate: 'inventory',
    expectedRevision: revision,
    command: { type, payload: { heroId: HERO, revision, ...payload } },
  };
  return socket.send(envelope);
}

async function heroStandingAt(presence: Presence | null) {
  resetFakePlayerServer(HERO, (progress) => {
    progress.presence = presence;
  });
  const claimed = await inventoryCommand('CLAIM_CAMP_CHEST');
  expect(claimed.result).toBe('applied');
}

const takeOut = {
  from: { container: 'stash', index: 0 },
  to: { container: 'bag', index: 0 },
  split: false,
};

describe('the fake player server checks where the hero stands, like the real one', () => {
  beforeEach(() => resetFakePlayerServer(HERO));

  it('takes an item out of the stash next to the chest', async () => {
    await heroStandingAt(NEAR);
    expect(await inventoryCommand('MOVE_ITEM', takeOut)).toMatchObject({ result: 'applied' });
  });

  it.each([
    ['far from the chest', FAR],
    ['with no known place', null],
  ])('refuses a stash move %s with STASH_LOCKED and keeps the revision', async (_l, presence) => {
    await heroStandingAt(presence);
    const before = snapshot().aggregates.inventory!;

    const answer = await inventoryCommand('MOVE_ITEM', takeOut);

    expect(answer).toMatchObject({ result: 'rejected', code: 'STASH_LOCKED' });
    expect(snapshot().aggregates.inventory).toEqual(before);
  });

  it('still moves coins from the bag into a hand far from the chest', async () => {
    await heroStandingAt(FAR);
    await inventoryCommand('DEV_GRANT_ITEM', { key: K.COINS, amount: 150 });
    const held = snapshot().aggregates.inventory!.state as InventoryState;
    const index = held.bag.findIndex((cell) => cell?.key === K.COINS);

    const answer = await inventoryCommand('MOVE_ITEM', {
      from: { container: 'bag', index },
      to: { container: 'equip', slot: 'weapon' },
      split: false,
    });

    expect(answer).toMatchObject({ result: 'applied' });
    const after = answer.aggregates.inventory!.state as InventoryState;
    expect(after.equip.weapon).toMatchObject({ amount: 150 });
  });
});

describe('the fake player server runs the trader like the real one', () => {
  const [STALL] = campObjectSpots(K.TRADER_STALL);
  const AT_STALL: Presence = { ...NEAR, coordinates: getHexNeighbors(STALL)[0] };
  const AWAY: Presence = {
    ...NEAR,
    coordinates: { columnIndex: STALL.columnIndex + 2, rowIndex: STALL.rowIndex },
  };

  async function buyFirstGood(presence: Presence) {
    resetFakePlayerServer(HERO, (progress) => {
      progress.presence = presence;
    });
    await inventoryCommand('DEV_GRANT_ITEM', { key: K.COINS, amount: 2000 });
    const goods = (snapshot().aggregates.progress!.state as ProgressState).traders.ilva!.goods;
    const index = goods.findIndex((cell) => cell !== null);
    const good = goods[index]!;
    return inventoryCommand('SHOP_BUY', {
      trader: 'ilva',
      from: { list: 'goods', index },
      to: 'auto',
      split: false,
      expectedPrice: coinPriceOf(good.key)! * good.amount,
    });
  }

  it('shows the rolled goods of an untouched trader without its seed', () => {
    const progress = snapshot().aggregates.progress!;
    const traders = (progress.state as ProgressState).traders;
    expect(traders.ilva!.goods.some((cell) => cell !== null)).toBe(true);
    expect(JSON.stringify(progress)).not.toContain(FAKE_RNG_SEED);
  });

  it('buys next to the stall and answers NOT_AT_TRADER away from it', async () => {
    const bought = await buyFirstGood(AT_STALL);
    expect(bought.result).toBe('applied');
    expect(bought.aggregates.progress!.state).toMatchObject({ traders: { ilva: { serial: 0 } } });
    expect(await buyFirstGood(AWAY)).toMatchObject({ result: 'rejected', code: 'NOT_AT_TRADER' });
  });
});
