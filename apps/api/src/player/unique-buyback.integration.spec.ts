import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from 'vitest';
import { TRADERS, type ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { mintItem, type InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { gameTokenFactory } from '@hexoflat/engine/tokens/game-tokens';
import type { ItemToken } from '@hexoflat/engine/tokens/token-schema';
import { sellPriceOf } from '@hexoflat/engine/trade/price-of';
import { walletCoins } from '@hexoflat/engine/trade/trader-view';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { heroAggregates, itemLedger } from '../db/schema';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

type Player = { userId: string; heroId: string };

const [STALL] = campObjectSpots(HEXOBJECT_KEYS.TRADER_STALL);
const NEAR = getHexNeighbors(STALL)[0];
const NOON = Date.UTC(2026, 10, 24, 12);
const MIDNIGHT = Date.UTC(2026, 10, 25);

function unique(n = 0): ItemToken {
  const made = gameTokenFactory().createUnique('lantern-eater', {
    seed: 'da5c-api',
    sourceId: `test:da5c.${randomUUID()}`,
    n,
    mapTier: 3,
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

describe.skipIf(!inject('dbAvailable'))('DA5c: unique buy-back (real Postgres)', () => {
  let kit: TestKit;
  const clock = vi.spyOn(Date, 'now');

  beforeAll(() => {
    kit = createTestKit();
  });
  beforeEach(() => {
    clock.mockReturnValue(NOON);
  });
  afterEach(() => {
    clock.mockReset();
  });
  afterAll(async () => {
    clock.mockRestore();
    await kit.close();
  });

  const read = async ({ userId, heroId }: Player) => {
    const { aggregates } = await kit.service.snapshot(userId, heroId);
    return {
      inventory: aggregates.inventory!.state as InventoryState,
      inventoryRevision: aggregates.inventory!.revision,
      progress: aggregates.progress!.state as ProgressState,
      progressRevision: aggregates.progress!.revision,
    };
  };
  const tokensOf = (inventory: InventoryState) =>
    inventory.bag.flatMap((item) => item?.token ?? []);
  const writeState = (heroId: string, kind: 'inventory' | 'progress', set: object) =>
    kit.db
      .update(heroAggregates)
      .set(set)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, kind)));

  async function atStall(token?: ItemToken): Promise<Player> {
    const player = await kit.newPlayer();
    const { inventory, progress, progressRevision } = await read(player);
    const presence = { locationKey: 'camping' as const, mapId: randomUUID(), coordinates: NEAR };
    await writeState(player.heroId, 'progress', { state: { ...progress, traders: {}, presence } });
    expect(progressRevision).toBe(0);
    if (token) {
      inventory.bag[3] = { ...mintItem(inventory, HEXOBJECT_KEYS.SWORD, 1), token };
      inventory.idSeq += 1;
      await writeState(player.heroId, 'inventory', { state: inventory });
    }
    return player;
  }

  async function sell(player: Player, token: ItemToken) {
    const { inventory, inventoryRevision } = await read(player);
    const index = inventory.bag.findIndex((item) => item?.token?.id === token.id);
    const expectedPrice = sellPriceOf(TRADERS.ilva, inventory.bag[index]!)!;
    const command = envelope(
      player.heroId,
      'SHOP_SELL',
      { trader: 'ilva', from: { container: 'bag', index }, expectedPrice },
      inventoryRevision,
    );
    expect(await kit.service.execute(player.userId, command)).toMatchObject({ result: 'applied' });
    return expectedPrice;
  }

  async function buyBack(player: Player, token: ItemToken) {
    const { inventoryRevision } = await read(player);
    const payload = { trader: 'ilva', instanceId: token.instanceId };
    return envelope(player.heroId, 'SHOP_BUY_BACK_UNIQUE', payload, inventoryRevision);
  }

  it('DA5c-5: the list survives a reload within the day and the same instance comes back', async () => {
    const token = unique();
    const player = await atStall(token);
    const coins = walletCoins((await read(player)).inventory);
    const price = await sell(player, token);
    const reloaded = createTestKit();
    try {
      const { aggregates } = await reloaded.service.snapshot(player.userId, player.heroId);
      expect((aggregates.progress!.state as ProgressState).uniqueBuyback).toEqual({
        ilva: [{ token, price, dayId: 1 }],
      });
    } finally {
      await reloaded.close();
    }

    const command = await buyBack(player, token);
    const answer = await kit.service.execute(player.userId, command);
    expect(answer).toMatchObject({ result: 'applied' });
    const after = await read(player);
    expect(tokensOf(after.inventory)).toEqual([token]);
    expect(walletCoins(after.inventory)).toBe(coins);
    expect(after.progress.uniqueBuyback.ilva).toEqual([]);

    const rows = () =>
      kit.db.select().from(itemLedger).where(eq(itemLedger.commandId, command.commandId));
    expect((await rows()).map(({ itemKey, delta }) => [itemKey, delta]).sort()).toEqual([
      [HEXOBJECT_KEYS.COINS, -price],
      [HEXOBJECT_KEYS.SWORD, 1],
    ]);

    const replay = await kit.service.execute(player.userId, command);
    expect(replay.replayed).toBe(true);
    expect((await read(player)).inventory).toEqual(after.inventory);
    expect(await rows()).toHaveLength(2);
  });

  it('DA5c-2: the first command of the next day ends the list for good', async () => {
    const [token, fresh] = [unique(0), unique(1)];
    const player = await atStall(token);
    await sell(player, token);
    clock.mockReturnValue(MIDNIGHT);

    const late = await kit.service.execute(player.userId, await buyBack(player, token));
    expect(late).toMatchObject({ result: 'rejected', code: 'BUY_BACK_GONE' });

    const { inventory } = await read(player);
    const index = inventory.bag.findIndex((item) => item === null);
    inventory.bag[index] = { ...mintItem(inventory, HEXOBJECT_KEYS.SWORD, 1), token: fresh };
    inventory.idSeq += 1;
    await writeState(player.heroId, 'inventory', { state: inventory });
    const price = await sell(player, fresh);
    expect((await read(player)).progress.uniqueBuyback).toEqual({
      ilva: [{ token: fresh, price, dayId: 2 }],
    });
    expect(await kit.service.execute(player.userId, await buyBack(player, token))).toMatchObject({
      code: 'BUY_BACK_GONE',
    });
  });

  it('DA5c-4: another hero sees no entry and cannot buy it back', async () => {
    const token = unique();
    const owner = await atStall(token);
    await sell(owner, token);
    const other = await atStall();
    expect((await read(other)).progress.uniqueBuyback).toEqual({});
    expect(await kit.service.execute(other.userId, await buyBack(other, token))).toMatchObject({
      result: 'rejected',
      code: 'BUY_BACK_GONE',
    });
    expect((await read(owner)).progress.uniqueBuyback.ilva).toHaveLength(1);
  });

  it('DA5c-5: a progress v13 save loads with an empty list', async () => {
    const player = await kit.newPlayer();
    const { progress } = await read(player);
    const old: Record<string, unknown> = { ...progress, traders: {}, steps: 7 };
    delete old.uniqueBuyback;
    await writeState(player.heroId, 'progress', { schemaVersion: 13, state: old });
    expect((await read(player)).progress).toMatchObject({ steps: 7, uniqueBuyback: {} });
  });
});
