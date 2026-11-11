import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Presence } from '@hexoflat/engine';
import { campObjectSpots } from '@hexoflat/engine/content/boards/camp-object-spot';
import { coinPriceOf } from '@hexoflat/engine/content/content-accessors';
import { HEXOBJECT_KEYS as K } from '@hexoflat/engine/registry/hexobjects-registry';
import { sellUnitPrice } from '@hexoflat/engine/trade/trader-view';
import { TRADERS } from '@hexoflat/engine/content/traders.content';
import { getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { inventorySession } from '@/services/inventory/inventory-session';
import { settleInventorySync } from '@/services/inventory/inventory-sync';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useTraderStore } from '@/stores/trader-store';
import { sentCommands } from '@/test-support/fake-player-server';
import { seedFakeSession } from '@/test-support/fake-session';
import { buyFromTrader, currentInventory, refreshTrader, sellToTrader } from './trade-commands';
import { traderProjection } from './trader-projection';

vi.mock('@/services/player/player-socket', async () =>
  (await import('@/test-support/fake-player-server')).fakePlayerSocketModule(),
);

const HERO = 'hero-1';
const [STALL] = campObjectSpots(K.TRADER_STALL);
const AT_STALL: Presence = {
  locationKey: 'camping',
  mapId: 'camping-1',
  coordinates: getHexNeighbors(STALL)[0],
};
const AWAY: Presence = {
  ...AT_STALL,
  coordinates: { columnIndex: STALL.columnIndex + 2, rowIndex: STALL.rowIndex },
};

async function heroWithCoins(coins: number, presence: Presence = AT_STALL, will?: number) {
  setActivePinia(createPinia());
  seedFakeSession(HERO, { presence, ...(will === undefined ? {} : { will }) });
  const trader = useTraderStore();
  trader.open('ilva');
  if (coins > 0) useHeroInventoryStore().putToInventory(K.COINS, coins);
  await settleInventorySync();
  return trader;
}

function firstGood() {
  const goods = traderProjection.value.traders.ilva!.goods;
  const index = goods.findIndex((cell) => cell !== null);
  return { index, good: goods[index]! };
}

const bagContents = () =>
  currentInventory().bag.map((cell) => (cell ? `${cell.key}x${cell.amount}` : null));
const coins = () => useHeroInventoryStore().countItem(K.COINS);
const lastSent = () => sentCommands[sentCommands.length - 1];

describe('trade commands go to the server and wait for its answer', () => {
  beforeEach(() => {
    sentCommands.length = 0;
  });

  it('shows the server-rolled goods of the open trader', async () => {
    const trader = await heroWithCoins(0);

    expect(trader.view?.goods.some((cell) => cell !== null)).toBe(true);
    expect(trader.view).toBe(traderProjection.value.traders.ilva);
  });

  it('buys at the engine price and changes nothing before the answer', async () => {
    const trader = await heroWithCoins(2000);
    const { index, good } = firstGood();
    const price = coinPriceOf(good.key)! * good.amount;

    const pending = buyFromTrader('ilva', { list: 'goods', index }, 'auto');
    expect(coins()).toBe(2000);
    expect(trader.view?.goods[index]).toEqual(good);

    expect(await pending).toEqual({ ok: true });
    expect(lastSent().command).toMatchObject({
      type: 'SHOP_BUY',
      payload: { trader: 'ilva', from: { list: 'goods', index }, expectedPrice: price },
    });
    expect(coins()).toBe(2000 - price);
    expect(useHeroInventoryStore().countItem(good.key)).toBe(good.amount);
    expect(trader.view?.goods[index]).toEqual({ ...good, sold: true });
  });

  it('lets the server refuse a purchase it cannot pay and keeps the state', async () => {
    await heroWithCoins(1);
    const { index, good } = firstGood();
    const before = bagContents();

    expect(await buyFromTrader('ilva', { list: 'goods', index }, 'auto')).toEqual({
      ok: false,
      reason: 'NOT_ENOUGH_COINS',
      price: coinPriceOf(good.key)! * good.amount,
    });
    expect(lastSent().command.type).toBe('SHOP_BUY');
    expect(bagContents()).toEqual(before);
  });

  it('answers NOT_AT_TRADER away from the stall', async () => {
    await heroWithCoins(2000, AWAY);
    const { index } = firstGood();

    const outcome = await buyFromTrader('ilva', { list: 'goods', index }, 'auto');

    expect(outcome).toMatchObject({ ok: false, reason: 'NOT_AT_TRADER' });
    expect(coins()).toBe(2000);
  });

  it('sends nothing for an empty goods cell', async () => {
    const trader = await heroWithCoins(2000);
    const empty = trader.view!.goods.findIndex((cell) => cell === null);
    const sent = sentCommands.length;

    expect(await buyFromTrader('ilva', { list: 'goods', index: empty }, 'auto')).toEqual({
      ok: false,
      reason: 'EMPTY_SOURCE',
      price: null,
    });
    expect(sentCommands.length).toBe(sent);
  });

  it('takes the server state back when the shown goods were stale', async () => {
    await heroWithCoins(2000);
    const { index, good } = firstGood();
    const served = traderProjection.value;
    const stale = { ...served.traders.ilva!, goods: served.traders.ilva!.goods.slice() };
    stale.goods[index] = { key: K.SWORD, amount: 1 };
    traderProjection.value = { ...served, traders: { ilva: stale } };

    const outcome = await buyFromTrader('ilva', { list: 'goods', index }, 'auto');

    expect(outcome).toMatchObject({ ok: false, reason: 'PRICE_CHANGED' });
    expect(traderProjection.value.traders.ilva!.goods[index]).toEqual(good);
    expect(coins()).toBe(2000);
  });

  it('sells a bag item, pays the trader rate and lists it in BUYBACK', async () => {
    const trader = await heroWithCoins(0);
    useHeroInventoryStore().putToInventory(K.SWORD, 1);
    await settleInventorySync();
    const index = currentInventory().bag.findIndex((cell) => cell?.key === K.SWORD);
    const payout = sellUnitPrice(TRADERS.ilva, K.SWORD)!;

    expect(await sellToTrader('ilva', index)).toEqual({ ok: true });
    expect(lastSent().command).toMatchObject({
      type: 'SHOP_SELL',
      payload: { from: { container: 'bag', index }, expectedPrice: payout },
    });
    expect(coins()).toBe(payout);
    expect(useHeroInventoryStore().countItem(K.SWORD)).toBe(0);
    expect(trader.view?.buyback[0]).toEqual({ key: K.SWORD, amount: 1, unitPrice: payout });
  });

  it('refreshes for 20 Will, rolls a new serial and asks 40 next time', async () => {
    const trader = await heroWithCoins(0, AT_STALL, 50);

    expect(await refreshTrader('ilva')).toEqual({ ok: true });
    expect(lastSent()).toMatchObject({
      aggregate: 'progress',
      command: { type: 'SHOP_REFRESH', payload: { expectedPrice: 20 } },
    });
    expect(inventorySession.knowledge?.current).toBe(30);
    expect(trader.view?.serial).toBe(1);

    expect(await refreshTrader('ilva')).toEqual({
      ok: false,
      reason: 'WILL_REJECTED',
      price: 40,
    });
    expect(inventorySession.knowledge?.current).toBe(30);
    expect(trader.view?.serial).toBe(1);
  });
});
