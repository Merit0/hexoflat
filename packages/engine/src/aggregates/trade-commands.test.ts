import { describe, expect, it } from 'vitest';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import { rollGoods } from '../trade/roll-goods';
import { traderView, walletCoins } from '../trade/trader-view';
import { ILVA, inventoryWith } from '../trade/trade-test-setup';
import {
  PLAYER_COMMAND_AGGREGATES,
  PLAYER_COMMAND_REVISION,
  PLAYER_COMMAND_SCHEMAS,
  emptyProgressState,
  executePlayerCommand,
  upcastAggregate,
  type PlayerAggregates,
  type PlayerCommand,
  type PlayerCommandContext,
} from './index';

const HERO = 'hero-1';
const SEED = 'server-seed';
const AT_ILVA: PlayerCommandContext = {
  devGrantAllowed: false,
  inventory: { stashOpen: false, battleOpen: false },
  trade: { atTrader: 'ilva', rngSeed: SEED },
};

function parse(command: unknown): PlayerCommand {
  const type = (command as { type: keyof typeof PLAYER_COMMAND_SCHEMAS }).type;
  return PLAYER_COMMAND_SCHEMAS[type].parse(command);
}

function rich(): PlayerAggregates {
  return {
    inventory: inventoryWith({ 0: [HEXOBJECT_KEYS.COINS, 1000], 1: [HEXOBJECT_KEYS.AXE, 1] }),
    progress: emptyProgressState(HERO),
  };
}

const buy = (aggregates: PlayerAggregates, expectedPrice: number, extra = {}) =>
  parse({
    type: 'SHOP_BUY',
    payload: {
      heroId: HERO,
      revision: aggregates.inventory.revision,
      trader: 'ilva',
      from: { list: 'goods', index: 0 },
      to: 'auto',
      expectedPrice,
      ...extra,
    },
  });

const sell = (aggregates: PlayerAggregates, expectedPrice: number) =>
  parse({
    type: 'SHOP_SELL',
    payload: {
      heroId: HERO,
      revision: aggregates.inventory.revision,
      trader: 'ilva',
      from: { container: 'bag', index: 1 },
      expectedPrice,
    },
  });

const refresh = (aggregates: PlayerAggregates, expectedPrice: number) =>
  parse({
    type: 'SHOP_REFRESH',
    payload: {
      heroId: HERO,
      revision: aggregates.progress.knowledge.revision,
      trader: 'ilva',
      expectedPrice,
    },
  });

function firstGoodsPrice(aggregates: PlayerAggregates): number {
  const good = traderView(aggregates.progress, 'ilva', SEED).goods[0]!;
  return good.amount * 12;
}

function apply(aggregates: PlayerAggregates, command: PlayerCommand): PlayerAggregates {
  const outcome = executePlayerCommand(aggregates, command, AT_ILVA);
  if (!outcome.ok) throw new Error(outcome.code);
  return { ...aggregates, ...outcome.changed };
}

describe('shop command schemas', () => {
  it('are strict and touch inventory + progress, or progress alone for a refresh', () => {
    const ok = buy(rich(), 24);
    expect(ok.type).toBe('SHOP_BUY');
    expect(() => buy(rich(), 24, { price: 1 })).toThrow();
    expect(() => buy(rich(), 0)).toThrow();
    expect(() => buy(rich(), 24, { trader: 'nobody' })).toThrow();
    expect(() => buy(rich(), 24, { to: { container: 'stash', index: 0 } })).toThrow();
    expect(PLAYER_COMMAND_AGGREGATES.SHOP_BUY).toEqual(['inventory', 'progress']);
    expect(PLAYER_COMMAND_AGGREGATES.SHOP_SELL).toEqual(['inventory', 'progress']);
    expect(PLAYER_COMMAND_AGGREGATES.SHOP_REFRESH).toEqual(['progress']);
    expect(PLAYER_COMMAND_REVISION.SHOP_BUY).toBe('aggregate');
    expect(PLAYER_COMMAND_REVISION.SHOP_SELL).toBe('aggregate');
    expect(PLAYER_COMMAND_REVISION.SHOP_REFRESH).toBe('knowledge');
  });
});

describe('SHOP_BUY and SHOP_SELL', () => {
  it('buys from the goods of serial 0, stores the trader and bumps the inventory revision', () => {
    const before = rich();
    const price = firstGoodsPrice(before);
    const outcome = executePlayerCommand(before, buy(before, price), AT_ILVA);
    if (!outcome.ok) throw new Error(outcome.code);
    expect(outcome.events.map((event) => event.type)).toEqual(['ITEM_BOUGHT', 'INVENTORY_CHANGED']);
    expect(outcome.events[0].payload).toMatchObject({
      heroId: HERO,
      trader: 'ilva',
      key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
      price,
      from: 'goods',
    });
    expect(outcome.changed.inventory?.revision).toBe(1);
    expect(walletCoins(outcome.changed.inventory!)).toBe(1000 - price);
    expect(outcome.changed.progress?.traders.ilva?.goods[0]).toBeNull();
    expect(before.progress.traders).toEqual({});
  });

  it('sells into BUYBACK, which the next command reads back', () => {
    const sold = apply(rich(), sell(rich(), 19));
    expect(sold.progress.traders.ilva?.buyback[0]).toEqual({
      key: HEXOBJECT_KEYS.AXE,
      amount: 1,
      unitPrice: 19,
    });
    expect(sold.progress.traders.ilva?.goods).toEqual(
      rollGoods(ILVA, deriveStream(SEED, 'trader:ilva:0')),
    );
    const back = apply(sold, buy(sold, 19, { from: { list: 'buyback', index: 0 } }));
    expect(walletCoins(back.inventory)).toBe(1000);
  });

  it('refuses away from the stall, without a trade context, in a battle and with a stale revision', () => {
    const state = rich();
    const command = sell(state, 19);
    const away = { ...AT_ILVA, trade: { atTrader: null, rngSeed: SEED } };
    expect(executePlayerCommand(state, command, away)).toMatchObject({
      ok: false,
      code: 'NOT_AT_TRADER',
    });
    const bare = { devGrantAllowed: false, inventory: AT_ILVA.inventory };
    expect(executePlayerCommand(state, command, bare)).toMatchObject({ code: 'NOT_AT_TRADER' });
    const battle = { ...AT_ILVA, inventory: { stashOpen: false, battleOpen: true } };
    expect(executePlayerCommand(state, command, battle)).toMatchObject({ code: 'BATTLE_OPEN' });
    const stale = parse({ ...command, payload: { ...command.payload, revision: 7 } });
    const refused = executePlayerCommand(state, stale, AT_ILVA);
    expect(refused).toMatchObject({ ok: false, code: 'INVENTORY_STALE' });
    expect(refused.events[0]).toMatchObject({
      type: 'TRADE_REJECTED',
      payload: { command: 'SHOP_SELL', reason: 'INVENTORY_STALE' },
    });
  });

  it('answers NOT_ENOUGH_COINS and PRICE_CHANGED with the real price and changes nothing', () => {
    const poor = rich();
    poor.inventory.bag[0] = { ...poor.inventory.bag[0]!, amount: 1 };
    const price = firstGoodsPrice(poor);
    const outcome = executePlayerCommand(poor, buy(poor, price), AT_ILVA);
    expect(outcome).toMatchObject({ ok: false, code: 'NOT_ENOUGH_COINS' });
    expect(outcome.events[0].payload).toMatchObject({ price });
    expect(executePlayerCommand(rich(), sell(rich(), 18), AT_ILVA)).toMatchObject({
      code: 'PRICE_CHANGED',
    });
  });
});

describe('SHOP_REFRESH', () => {
  it('costs 20, then 40, and 20 again after the next cave trip', () => {
    let state = rich();
    expect(executePlayerCommand(state, refresh(state, 40), AT_ILVA)).toMatchObject({
      code: 'PRICE_CHANGED',
    });
    const first = executePlayerCommand(state, refresh(state, 20), AT_ILVA);
    if (!first.ok) throw new Error(first.code);
    expect(first.events.map((event) => event.type)).toEqual(['WILL_SPENT', 'TRADER_REFRESHED']);
    expect(first.events[0].payload).toMatchObject({ amount: 20, reason: 'trader-refresh' });
    expect(first.events[1].payload).toMatchObject({ trader: 'ilva', serial: 1, willPrice: 20 });
    state = { ...state, ...first.changed };
    expect(state.progress.knowledge).toMatchObject({ current: 30, revision: 1 });

    expect(executePlayerCommand(state, refresh(state, 20), AT_ILVA)).toMatchObject({
      code: 'PRICE_CHANGED',
    });
    expect(executePlayerCommand(state, refresh(state, 40), AT_ILVA)).toMatchObject({
      code: 'WILL_REJECTED',
    });
    state.progress = { ...state.progress, knowledge: { ...state.progress.knowledge, current: 50 } };
    state = apply(state, refresh(state, 40));
    expect(state.progress.knowledge.current).toBe(10);
    expect(state.progress.traders.ilva).toMatchObject({ serial: 2, trip: 0, paidRefreshes: 2 });

    state.progress = { ...state.progress, trips: 1 };
    state.progress.knowledge = { ...state.progress.knowledge, current: 50 };
    state = apply(state, refresh(state, 20));
    expect(state.progress.traders.ilva).toMatchObject({ serial: 3, trip: 1, paidRefreshes: 1 });
    expect(state.progress.knowledge.current).toBe(30);
  });

  it('rolls the goods of the next serial and wipes BUYBACK', () => {
    const sold = apply(rich(), sell(rich(), 19));
    const fresh = apply(sold, refresh(sold, 20));
    expect(fresh.progress.traders.ilva?.goods).toEqual(
      rollGoods(ILVA, deriveStream(SEED, 'trader:ilva:1')),
    );
    expect(fresh.progress.traders.ilva?.buyback.every((cell) => cell === null)).toBe(true);
    expect(fresh.inventory).toBe(sold.inventory);
  });

  it('refuses with too little Will or a stale knowledge revision and changes nothing', () => {
    const state = rich();
    state.progress.knowledge.current = 19;
    const outcome = executePlayerCommand(state, refresh(state, 20), AT_ILVA);
    expect(outcome).toMatchObject({ ok: false, code: 'WILL_REJECTED' });
    expect(state.progress.knowledge.current).toBe(19);
    expect(state.progress.traders).toEqual({});
    const stale = parse({
      ...refresh(state, 20),
      payload: { ...refresh(state, 20).payload, revision: 3 },
    });
    expect(executePlayerCommand(rich(), stale, AT_ILVA)).toMatchObject({ code: 'STALE_REVISION' });
  });
});

describe('progress v6', () => {
  it('upcasts a stored v5 document with no trips and no traders', () => {
    const v5: Partial<ReturnType<typeof emptyProgressState>> = emptyProgressState(HERO);
    delete v5.trips;
    delete v5.traders;
    const upcast = upcastAggregate('progress', 5, JSON.parse(JSON.stringify(v5)), { heroId: HERO });
    expect(upcast).toEqual(emptyProgressState(HERO));
    expect(upcast).toMatchObject({ trips: 0, traders: {} });
  });

  it('refuses a stored trader with an unknown item or an unknown trader key', () => {
    const progress = { ...emptyProgressState(HERO) } as Record<string, unknown>;
    const trader = { serial: 0, trip: 0, paidRefreshes: 0, goods: [], buyback: [] };
    expect(() =>
      upcastAggregate(
        'progress',
        6,
        { ...progress, traders: { nobody: trader } },
        { heroId: HERO },
      ),
    ).toThrow();
    const odd = { ...trader, goods: [{ key: 'gold-bar', amount: 1 }] };
    expect(() =>
      upcastAggregate('progress', 6, { ...progress, traders: { ilva: odd } }, { heroId: HERO }),
    ).toThrow();
  });
});
