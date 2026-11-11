import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { TRADERS, traderView, type ProgressState } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { commandJournal, heroAggregates, itemLedger } from '../db/schema';
import { ensureExpedition, writeServerDocument } from '../expedition/expedition-store';
import { createTestKit, envelope, type TestKit } from './player-test-kit';

const dbAvailable = inject('dbAvailable');
const { COINS, SWORD, HEALTH_BOTTLE } = HEXOBJECT_KEYS;
const [STALL] = campObjectSpots(HEXOBJECT_KEYS.TRADER_STALL);
const NEAR = getHexNeighbors(STALL)[0];
const FAR = { columnIndex: STALL.columnIndex + 2, rowIndex: STALL.rowIndex };
const SWORD_PRICE = coinPriceOf(SWORD)!;
const BOTTLE_PRICE = coinPriceOf(HEALTH_BOTTLE)!;
const SWORD_SELL = Math.floor(
  (SWORD_PRICE * TRADERS.ilva.sellRate.num) / TRADERS.ilva.sellRate.den,
);
const START_COINS = 1000;

describe.skipIf(!dbAvailable)('the camp trader on the server (real Postgres)', () => {
  let kit: TestKit;
  beforeAll(() => {
    kit = createTestKit();
  });
  afterAll(async () => {
    await kit.close();
  });

  const snapshotOf = (userId: string, heroId: string) => kit.service.snapshot(userId, heroId);
  const inventoryOf = async (userId: string, heroId: string) =>
    (await snapshotOf(userId, heroId)).aggregates.inventory!;
  const progressOf = async (userId: string, heroId: string) =>
    (await snapshotOf(userId, heroId)).aggregates.progress!;
  const bagAmount = (inventory: { state: unknown }, key: string) =>
    (inventory.state as InventoryState).bag
      .filter((cell) => cell?.key === key)
      .reduce((sum, cell) => sum + (cell?.amount ?? 0), 0);
  const seedOf = async (heroId: string) => {
    const [row] = await kit.db
      .select()
      .from(heroAggregates)
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));
    return (row.serverState as { rngSeed?: string }).rngSeed;
  };
  const journalRow = async (commandId: string) =>
    (await kit.db.select().from(commandJournal).where(eq(commandJournal.commandId, commandId)))[0];
  const ledgerRows = (commandId: string) =>
    kit.db.select().from(itemLedger).where(eq(itemLedger.commandId, commandId));

  async function arrive(userId: string, heroId: string, mapId: string, at: typeof NEAR) {
    const { revision } = await progressOf(userId, heroId);
    const step = envelope(
      heroId,
      'ARRIVE',
      { locationKey: 'camping', mapId, coordinates: at },
      revision,
      { aggregate: 'progress' },
    );
    delete (step.command.payload as { revision?: number }).revision;
    expect((await kit.service.execute(userId, step)).result).toBe('applied');
  }

  async function heroInCamp(at: typeof NEAR, mapId: string = randomUUID()) {
    const { userId, heroId } = await kit.newPlayer();
    await arrive(userId, heroId, mapId, at);
    const granted = await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_GRANT_ITEM', { key: COINS, amount: START_COINS }, 0),
    );
    expect(granted.result).toBe('applied');
    await kit.service.traderFixture(userId, heroId, {
      trader: 'ilva',
      goods: [
        { key: SWORD, amount: 1 },
        { key: HEALTH_BOTTLE, amount: 5 },
      ],
    });
    return { userId, heroId, mapId };
  }

  const buy = (
    heroId: string,
    revision: number,
    index: number,
    expectedPrice: number,
    extra = {},
  ) =>
    envelope(
      heroId,
      'SHOP_BUY',
      { trader: 'ilva', from: { list: 'goods', index }, to: 'auto', split: false, expectedPrice },
      revision,
      extra,
    );

  const refresh = async (userId: string, heroId: string, expectedPrice: number) => {
    const progress = await progressOf(userId, heroId);
    const knowledge = (progress.state as ProgressState).knowledge.revision;
    const command = envelope(
      heroId,
      'SHOP_REFRESH',
      { trader: 'ilva', expectedPrice },
      progress.revision,
      { aggregate: 'progress' },
    );
    (command.command.payload as { revision: number }).revision = knowledge;
    return command;
  };

  it('buys next to the stall: coins paid, item in the bag, one journal row and a shop ledger row per key', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const before = await inventoryOf(userId, heroId);
    const command = buy(heroId, before.revision, 0, SWORD_PRICE);

    const answer = await kit.service.execute(userId, command);

    expect(answer.result).toBe('applied');
    expect(answer.events.map((event) => event.type)).toEqual(['ITEM_BOUGHT', 'INVENTORY_CHANGED']);
    const after = await inventoryOf(userId, heroId);
    expect(bagAmount(after, COINS)).toBe(START_COINS - SWORD_PRICE);
    expect(bagAmount(after, SWORD)).toBe(1);
    const goods = ((await progressOf(userId, heroId)).state as ProgressState).traders.ilva!.goods;
    expect(goods[0]).toMatchObject({ key: SWORD, amount: 1, sold: true });
    expect(goods[1]).toEqual({ key: HEALTH_BOTTLE, amount: 5 });
    expect(await journalRow(command.commandId)).toMatchObject({
      result: 'applied',
      commandType: 'SHOP_BUY',
      newRevision: before.revision + 1,
    });
    const ledger = await ledgerRows(command.commandId);
    expect(
      ledger.map(({ itemKey, delta, balanceAfter, reason }) => ({
        itemKey,
        delta,
        balanceAfter,
        reason,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          itemKey: COINS,
          delta: -SWORD_PRICE,
          balanceAfter: START_COINS - SWORD_PRICE,
          reason: 'shop',
        },
        { itemKey: SWORD, delta: 1, balanceAfter: 1, reason: 'shop' },
      ]),
    );
    expect(ledger).toHaveLength(2);
  });

  it('sells from the bag into the buyback row and writes the coins and the item to the ledger', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const bought = await kit.service.execute(
      userId,
      buy(heroId, (await inventoryOf(userId, heroId)).revision, 0, SWORD_PRICE),
    );
    const inventory = bought.aggregates.inventory!;
    const swordIndex = (inventory.state as InventoryState).bag.findIndex((c) => c?.key === SWORD);
    const command = envelope(
      heroId,
      'SHOP_SELL',
      {
        trader: 'ilva',
        from: { container: 'bag', index: swordIndex },
        split: false,
        expectedPrice: SWORD_SELL,
      },
      inventory.revision,
    );

    const answer = await kit.service.execute(userId, command);

    expect(answer.result).toBe('applied');
    const after = await inventoryOf(userId, heroId);
    expect(bagAmount(after, SWORD)).toBe(0);
    expect(bagAmount(after, COINS)).toBe(START_COINS - SWORD_PRICE + SWORD_SELL);
    expect(
      ((await progressOf(userId, heroId)).state as ProgressState).traders.ilva!.buyback[0],
    ).toEqual({ key: SWORD, amount: 1, unitPrice: SWORD_SELL });
    const ledger = await ledgerRows(command.commandId);
    expect(ledger).toHaveLength(2);
    expect(ledger.find((row) => row.itemKey === COINS)).toMatchObject({
      delta: SWORD_SELL,
      balanceAfter: START_COINS - SWORD_PRICE + SWORD_SELL,
      reason: 'shop',
    });
    expect(ledger.find((row) => row.itemKey === SWORD)).toMatchObject({
      delta: -1,
      balanceAfter: 0,
      reason: 'shop',
    });
  });

  it('applies a repeated commandId once and answers the repeat from the journal', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const { revision } = await inventoryOf(userId, heroId);
    const command = buy(heroId, revision, 1, BOTTLE_PRICE * 5);

    const first = await kit.service.execute(userId, command);
    const again = await kit.service.execute(userId, command);

    expect(first.result).toBe('applied');
    expect(again).toMatchObject({ result: 'applied', replayed: true, events: first.events });
    const after = await inventoryOf(userId, heroId);
    expect(bagAmount(after, HEALTH_BOTTLE)).toBe(5);
    expect(bagAmount(after, COINS)).toBe(START_COINS - BOTTLE_PRICE * 5);
    expect(after.revision).toBe(revision + 1);
    expect(await ledgerRows(command.commandId)).toHaveLength(2);
    const journal = await kit.db
      .select()
      .from(commandJournal)
      .where(eq(commandJournal.commandId, command.commandId));
    expect(journal).toHaveLength(1);
  });

  it('answers a stale revision with REVISION_CONFLICT and a wrong Will revision with STALE_REVISION', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const { revision } = await inventoryOf(userId, heroId);
    const stale = await kit.service.execute(userId, buy(heroId, revision - 1, 0, SWORD_PRICE));
    expect(stale).toMatchObject({ result: 'conflict', code: 'REVISION_CONFLICT' });
    expect(bagAmount(await inventoryOf(userId, heroId), SWORD)).toBe(0);

    const command = await refresh(userId, heroId, 20);
    (command.command.payload as { revision: number }).revision += 1;
    expect(await kit.service.execute(userId, command)).toMatchObject({
      result: 'rejected',
      code: 'STALE_REVISION',
    });
  });

  it('refuses every deal far from the stall with NOT_AT_TRADER and changes nothing', async () => {
    const { userId, heroId } = await heroInCamp(FAR);
    const before = await snapshotOf(userId, heroId);
    const command = buy(heroId, before.aggregates.inventory!.revision, 0, SWORD_PRICE);

    expect(await kit.service.execute(userId, command)).toMatchObject({
      result: 'rejected',
      code: 'NOT_AT_TRADER',
    });
    expect(await kit.service.execute(userId, await refresh(userId, heroId, 20))).toMatchObject({
      result: 'rejected',
      code: 'NOT_AT_TRADER',
    });
    expect(await snapshotOf(userId, heroId)).toEqual(before);
    expect(await journalRow(command.commandId)).toMatchObject({
      result: 'rejected',
      reason: 'NOT_AT_TRADER',
    });
    expect(await ledgerRows(command.commandId)).toHaveLength(0);
  });

  it('refuses buying and refreshing with BATTLE_OPEN while a battle is open on the map', async () => {
    const { userId, heroId, mapId } = await heroInCamp(NEAR);
    const expeditionId = await ensureExpedition(kit.db, userId, heroId);
    await kit.db.transaction((tx) =>
      writeServerDocument(tx, expeditionId, `srv-world:${mapId}`, JSON.stringify({ battle: {} })),
    );
    const before = await snapshotOf(userId, heroId);

    const bought = await kit.service.execute(
      userId,
      buy(heroId, before.aggregates.inventory!.revision, 0, SWORD_PRICE),
    );
    const refreshed = await kit.service.execute(userId, await refresh(userId, heroId, 20));

    expect(bought).toMatchObject({ result: 'rejected', code: 'BATTLE_OPEN' });
    expect(refreshed).toMatchObject({ result: 'rejected', code: 'BATTLE_OPEN' });
    expect(await snapshotOf(userId, heroId)).toEqual(before);
  });

  it('refuses a deal at an old price with PRICE_CHANGED and keeps the coins', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const { revision } = await inventoryOf(userId, heroId);
    const command = buy(heroId, revision, 0, SWORD_PRICE - 4);

    const answer = await kit.service.execute(userId, command);

    expect(answer).toMatchObject({ result: 'rejected', code: 'PRICE_CHANGED' });
    expect(answer.events[0]).toMatchObject({
      type: 'TRADE_REJECTED',
      payload: { reason: 'PRICE_CHANGED', price: SWORD_PRICE },
    });
    expect(bagAmount(await inventoryOf(userId, heroId), COINS)).toBe(START_COINS);
    expect(await journalRow(command.commandId)).toMatchObject({
      result: 'rejected',
      reason: 'PRICE_CHANGED',
    });
  });

  describe('discounted goods', () => {
    const HALF = SWORD_PRICE / 2;
    const deal = (heroId: string, revision: number, guess: number) =>
      envelope(heroId, 'SHOP_DEAL', { trader: 'ilva', index: 0, guess, to: 'auto' }, revision);

    async function heroWithDiscount() {
      const hero = await heroInCamp(NEAR);
      await kit.service.traderFixture(hero.userId, hero.heroId, {
        trader: 'ilva',
        goods: [{ key: SWORD, amount: 1, discountPercent: 50 }],
      });
      return hero;
    }

    it('buys at the discounted price on an exact guess and reports what was saved', async () => {
      const { userId, heroId } = await heroWithDiscount();
      const { revision } = await inventoryOf(userId, heroId);

      const answer = await kit.service.execute(userId, deal(heroId, revision, HALF));

      expect(answer.result).toBe('applied');
      expect(answer.events[0]).toMatchObject({
        type: 'ITEM_BOUGHT',
        payload: { price: HALF, saved: HALF, discounted: true },
      });
      expect(bagAmount(await inventoryOf(userId, heroId), COINS)).toBe(START_COINS - HALF);
    });

    it('wastes the offer on a wrong guess, keeps the coins and persists the status', async () => {
      const { userId, heroId } = await heroWithDiscount();
      const { revision } = await inventoryOf(userId, heroId);

      const answer = await kit.service.execute(userId, deal(heroId, revision, HALF + 1));

      expect(answer.result).toBe('applied');
      expect(answer.events[0]).toMatchObject({ type: 'DEAL_WASTED' });
      expect(bagAmount(await inventoryOf(userId, heroId), COINS)).toBe(START_COINS);
      const goods = ((await progressOf(userId, heroId)).state as ProgressState).traders.ilva!.goods;
      expect(goods[0]).toMatchObject({ key: SWORD, wasted: true });
      const next = await inventoryOf(userId, heroId);
      const again = await kit.service.execute(userId, deal(heroId, next.revision, HALF));
      expect(again.result).toBe('rejected');
    });

    it('refuses a plain purchase of a discounted offer with NEEDS_DEAL', async () => {
      const { userId, heroId } = await heroWithDiscount();
      const { revision } = await inventoryOf(userId, heroId);

      const answer = await kit.service.execute(userId, buy(heroId, revision, 0, SWORD_PRICE));

      expect(answer).toMatchObject({ result: 'rejected', code: 'NEEDS_DEAL' });
    });
  });

  describe('own listings', () => {
    const list = (heroId: string, revision: number, index: number, unitPrice: number) =>
      envelope(
        heroId,
        'SHOP_LIST',
        { trader: 'ilva', from: { container: 'bag', index }, unitPrice },
        revision,
      );
    const unlist = (heroId: string, revision: number, slot: number) =>
      envelope(heroId, 'SHOP_UNLIST', { trader: 'ilva', slot }, revision);

    async function heroWithSword() {
      const hero = await heroInCamp(NEAR);
      const current = (await inventoryOf(hero.userId, hero.heroId)).revision;
      const granted = await kit.service.execute(
        hero.userId,
        envelope(hero.heroId, 'DEV_GRANT_ITEM', { key: SWORD, amount: 1 }, current),
      );
      expect(granted.result).toBe('applied');
      const inventory = await inventoryOf(hero.userId, hero.heroId);
      const index = (inventory.state as InventoryState).bag.findIndex(
        (cell) => cell?.key === SWORD,
      );
      return { ...hero, index };
    }

    it('lists a bag item into a slot, writes the ledger and keeps the slot through a reload', async () => {
      const { userId, heroId, index } = await heroWithSword();
      const { revision } = await inventoryOf(userId, heroId);
      const command = list(heroId, revision, index, 300);

      const answer = await kit.service.execute(userId, command);

      expect(answer.result).toBe('applied');
      expect(answer.events[0]).toMatchObject({
        type: 'ITEM_LISTED',
        payload: { key: SWORD, amount: 1, unitPrice: 300, slot: 0 },
      });
      expect(bagAmount(await inventoryOf(userId, heroId), SWORD)).toBe(0);
      const listings = ((await progressOf(userId, heroId)).state as ProgressState).listings;
      expect(listings[0]).toEqual({ key: SWORD, amount: 1, unitPrice: 300 });
      const ledger = await ledgerRows(command.commandId);
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ itemKey: SWORD, delta: -1, reason: 'listing' });
    });

    it('takes the slot back into the bag and refuses to list away from the stall', async () => {
      const { userId, heroId, index } = await heroWithSword();
      let { revision } = await inventoryOf(userId, heroId);
      expect((await kit.service.execute(userId, list(heroId, revision, index, 300))).result).toBe(
        'applied',
      );
      ({ revision } = await inventoryOf(userId, heroId));

      const back = await kit.service.execute(userId, unlist(heroId, revision, 0));

      expect(back.result).toBe('applied');
      expect(bagAmount(await inventoryOf(userId, heroId), SWORD)).toBe(1);
      const listings = ((await progressOf(userId, heroId)).state as ProgressState).listings;
      expect(listings.every((cell) => cell === null)).toBe(true);

      const far = await heroWithSword();
      await arrive(far.userId, far.heroId, randomUUID(), FAR);
      const farRevision = (await inventoryOf(far.userId, far.heroId)).revision;
      const refused = await kit.service.execute(
        far.userId,
        list(far.heroId, farRevision, far.index, 300),
      );
      expect(refused).toMatchObject({ result: 'rejected', code: 'NOT_AT_TRADER' });
    });
  });

  it('refreshes the goods for Will next to the stall, doubling the next price', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const answer = await kit.service.execute(userId, await refresh(userId, heroId, 20));

    expect(answer.result).toBe('applied');
    const progress = (await progressOf(userId, heroId)).state as ProgressState;
    expect(progress.knowledge.current).toBe(30);
    expect(progress.traders.ilva).toMatchObject({ serial: 1, paidRefreshes: 1 });
    expect(await kit.service.execute(userId, await refresh(userId, heroId, 20))).toMatchObject({
      result: 'rejected',
      code: 'PRICE_CHANGED',
    });
  });

  it('rolls the untouched trader from the hidden seed and never sends the seed to the client', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await arrive(userId, heroId, randomUUID(), NEAR);
    await kit.service.execute(
      userId,
      envelope(heroId, 'DEV_GRANT_ITEM', { key: COINS, amount: START_COINS }, 0),
    );
    const seed = (await seedOf(heroId))!;
    const snapshot = await snapshotOf(userId, heroId);
    const progress = snapshot.aggregates.progress!.state as ProgressState;
    expect(progress.traders.ilva).toEqual(traderView({ ...progress, traders: {} }, 'ilva', seed));

    const first = progress.traders.ilva!.goods.findIndex(
      (cell) => cell !== null && !cell.discountPercent,
    );
    const good = progress.traders.ilva!.goods[first]!;
    const bought = await kit.service.execute(
      userId,
      envelope(
        heroId,
        'SHOP_BUY',
        {
          trader: 'ilva',
          from: { list: 'goods', index: first },
          to: 'auto',
          split: false,
          expectedPrice: coinPriceOf(good.key)! * good.amount,
        },
        snapshot.aggregates.inventory!.revision,
      ),
    );
    expect(bought.result).toBe('applied');
    const refreshed = await kit.service.execute(userId, await refresh(userId, heroId, 20));
    expect(refreshed.result).toBe('applied');
    const fixture = await kit.service.traderFixture(userId, heroId, { trader: 'ilva', trips: 1 });

    for (const answer of [snapshot, bought, refreshed, fixture, await snapshotOf(userId, heroId)]) {
      expect(JSON.stringify(answer)).not.toContain(seed);
    }
  });

  it('creates a missing seed once for an old hero and keeps the same goods afterwards', async () => {
    const { userId, heroId } = await kit.newPlayer();
    await snapshotOf(userId, heroId);
    await kit.db
      .update(heroAggregates)
      .set({ serverState: {} })
      .where(and(eq(heroAggregates.heroId, heroId), eq(heroAggregates.kind, 'progress')));

    const first = await progressOf(userId, heroId);
    const seed = await seedOf(heroId);
    const second = await progressOf(userId, heroId);

    expect(seed).toMatch(/^[0-9a-f]{32}$/);
    expect(await seedOf(heroId)).toBe(seed);
    expect(second.state).toEqual(first.state);
  });

  it('sets the trader through the dev fixture only when the fixtures flag is on', async () => {
    const { userId, heroId } = await heroInCamp(NEAR);
    const answer = await kit.service.traderFixture(userId, heroId, {
      trader: 'ilva',
      goods: [null, { key: SWORD, amount: 1 }],
      buyback: [{ key: HEALTH_BOTTLE, amount: 2, unitPrice: 4 }],
      trips: 3,
    });
    expect(answer.aggregates.progress!.state).toMatchObject({
      trips: 3,
      traders: {
        ilva: {
          goods: [null, { key: SWORD, amount: 1 }, ...Array.from({ length: 6 }, () => null)],
          buyback: [
            { key: HEALTH_BOTTLE, amount: 2, unitPrice: 4 },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      },
    });
    await expect(
      kit.service.traderFixture(userId, heroId, {
        trader: 'ilva',
        goods: [{ key: COINS, amount: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_COMMAND' });

    vi.stubEnv('HEXOFLAT_E2E_FIXTURES', '');
    try {
      await expect(
        kit.service.traderFixture(userId, heroId, { trader: 'ilva', trips: 1 }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      vi.unstubAllEnvs();
    }
    expect(((await progressOf(userId, heroId)).state as ProgressState).trips).toBe(3);
  });
});
