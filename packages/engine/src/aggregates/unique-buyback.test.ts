import { describe, expect, it } from 'vitest';
import { ETokenType } from '../abstraction/hexobject-abstraction';
import { GAME_DAY_RULES } from '../content/game-day.content';
import { gameDayAt, trackGameDay } from '../game-day/game-day';
import { emptyInventoryState, mintItem, type InventoryState } from '../inventory/inventory-state';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { gameTokenFactory } from '../tokens/game-tokens';
import type { ItemToken } from '../tokens/token-schema';
import { sellPriceOf } from '../trade/price-of';
import { ILVA, SEED } from '../trade/trade-test-setup';
import { planRefresh } from '../trade/plan-refresh';
import { refreshPrice, traderView, walletCoins } from '../trade/trader-view';
import {
  AGGREGATES,
  PLAYER_COMMAND_SCHEMAS,
  emptyProgressState,
  executePlayerCommand,
  upcastAggregate,
  type PlayerAggregates,
  type PlayerCommandOutcome,
  type ProgressState,
} from './index';

const HERO = 'hero-1';
const OTHER = 'hero-2';
const NOON = Date.UTC(2026, 10, 24, 12);
const NEXT_DAY = NOON + 86_400_000;
const START_COINS = 100;

function unique(n = 0, uniqueKey = 'lantern-eater'): ItemToken {
  const made = gameTokenFactory().createUnique(uniqueKey, {
    seed: 'buyback-test',
    sourceId: 'test:buyback',
    n,
    mapTier: 3,
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

function baseSword(): ItemToken {
  const made = gameTokenFactory().createBase({
    seed: 'buyback-test',
    sourceId: 'test:buyback.base',
    n: 0,
    tokenType: ETokenType.IDOL,
    mapTier: 1,
    type: 'sword',
  });
  if (!made.ok) throw new Error(made.refusal.code);
  return made.value;
}

function heroWith(tokens: ItemToken[], heroId = HERO, coins = START_COINS): PlayerAggregates {
  const inventory = emptyInventoryState(heroId);
  if (coins > 0) inventory.bag[0] = mintItem(inventory, HEXOBJECT_KEYS.COINS, coins);
  tokens.forEach((token, index) => {
    inventory.bag[index + 1] = {
      ...mintItem(inventory, token.type as THexobjectKey, 1),
      token,
    };
  });
  return { inventory, progress: emptyProgressState(heroId) };
}

function run(aggregates: PlayerAggregates, command: unknown, now = NOON): PlayerCommandOutcome {
  const { type } = command as { type: keyof typeof PLAYER_COMMAND_SCHEMAS };
  const outcome = executePlayerCommand(aggregates, PLAYER_COMMAND_SCHEMAS[type].parse(command), {
    devGrantAllowed: false,
    inventory: { stashOpen: false, battleOpen: false },
    trade: {
      atTrader: 'ilva',
      rngSeed: SEED,
      dayId: gameDayAt(aggregates.progress.day, now).day.id,
    },
  });
  if (!outcome.ok) return outcome;
  const progress = outcome.changed.progress ?? aggregates.progress;
  const tracked = trackGameDay(aggregates.progress, { progress, events: outcome.events }, now);
  return {
    ok: true,
    changed: { ...outcome.changed, progress: tracked.progress },
    events: tracked.events,
  };
}

function apply(aggregates: PlayerAggregates, command: unknown, now = NOON) {
  const outcome = run(aggregates, command, now);
  if (!outcome.ok) throw new Error(outcome.code);
  return { aggregates: { ...aggregates, ...outcome.changed }, events: outcome.events };
}

function refusal(aggregates: PlayerAggregates, command: unknown, now = NOON): string {
  const before = structuredClone(aggregates);
  const outcome = run(aggregates, command, now);
  expect(aggregates).toEqual(before);
  if (outcome.ok) throw new Error('the command was accepted');
  return outcome.code;
}

const sell = ({ inventory }: PlayerAggregates, index = 1) => ({
  type: 'SHOP_SELL',
  payload: {
    heroId: inventory.heroId,
    revision: inventory.revision,
    trader: 'ilva',
    from: { container: 'bag', index },
    expectedPrice: sellPriceOf(ILVA, inventory.bag[index]!),
  },
});

const buyBack = ({ inventory }: PlayerAggregates, token: ItemToken, heroId = HERO) => ({
  type: 'SHOP_BUY_BACK_UNIQUE',
  payload: {
    heroId,
    revision: inventory.revision,
    trader: 'ilva',
    instanceId: token.instanceId,
  },
});

const projected = (progress: ProgressState, now = NOON) =>
  AGGREGATES.progress.project(progress, { rngSeed: SEED }, now) as ProgressState;
const held = (progress: ProgressState) => progress.uniqueBuyback.ilva ?? [];
const bagTokens = ({ bag }: InventoryState) => bag.flatMap((item) => item?.token ?? []);

describe('DA5c-1: buy back a sold unique instance on the same game day', () => {
  it('keeps the full instance and returns it for the exact coins of the sale', () => {
    const token = unique();
    const start = heroWith([token]);
    const price = sellPriceOf(ILVA, { key: token.type as THexobjectKey, token })!;

    const sold = apply(start, sell(start));
    expect(held(sold.aggregates.progress)).toEqual([{ token, price, dayId: 1 }]);
    expect(bagTokens(sold.aggregates.inventory)).toEqual([]);
    expect(walletCoins(sold.aggregates.inventory)).toBe(START_COINS + price);
    expect(sold.events).toContainEqual({
      type: 'UNIQUE_HELD_FOR_BUY_BACK',
      payload: {
        heroId: HERO,
        trader: 'ilva',
        instanceId: token.instanceId,
        uniqueKey: 'lantern-eater',
        price,
        dayId: 1,
      },
    });

    const back = apply(sold.aggregates, buyBack(sold.aggregates, token));
    expect(bagTokens(back.aggregates.inventory)).toEqual([token]);
    expect(walletCoins(back.aggregates.inventory)).toBe(START_COINS);
    expect(held(back.aggregates.progress)).toEqual([]);
    expect(back.events.map(({ type }) => type)).toEqual([
      'ITEM_BOUGHT',
      'UNIQUE_BOUGHT_BACK',
      'INVENTORY_CHANGED',
    ]);
    expect(back.events[0].payload).toMatchObject({ price, amount: 1, from: 'unique-buyback' });
  });

  it('returns the named instance of two instances of one template', () => {
    const [first, second] = [unique(0), unique(1)];
    const start = heroWith([first, second]);
    const one = apply(start, sell(start, 1)).aggregates;
    const index = one.inventory.bag.findIndex((item) => item?.token?.id === second.id);
    const both = apply(one, sell(one, index)).aggregates;
    expect(held(both.progress).map(({ token }) => token.instanceId)).toEqual([
      first.instanceId,
      second.instanceId,
    ]);

    const back = apply(both, buyBack(both, second)).aggregates;
    expect(bagTokens(back.inventory)).toEqual([second]);
    expect(held(back.progress).map(({ token }) => token)).toEqual([first]);
  });

  it('holds a unique outside BUYBACK, through New goods and beyond the seven BUYBACK cells', () => {
    const tokens = Array.from({ length: 9 }, (_, n) => unique(n));
    let current = heroWith(tokens);
    for (const token of tokens) {
      const index = current.inventory.bag.findIndex((item) => item?.token?.id === token.id);
      current = apply(current, sell(current, index)).aggregates;
    }
    expect(held(current.progress).map(({ token }) => token)).toEqual(tokens);
    const view = traderView(current.progress, 'ilva', SEED);
    expect(view.buyback.every((entry) => entry === null)).toBe(true);

    const refreshed = planRefresh(current.progress, 'ilva', {
      rngSeed: SEED,
      expectedPrice: refreshPrice(view, 0, ILVA),
    });
    if (!refreshed.ok) throw new Error(refreshed.reason);
    expect(held(refreshed.progress).map(({ token }) => token)).toEqual(tokens);
  });

  it('sells a base item to the ordinary BUYBACK as before', () => {
    const token = baseSword();
    const start = heroWith([token]);
    const sold = apply(start, sell(start)).aggregates;
    expect(sold.progress.uniqueBuyback).toEqual({});
    expect(traderView(sold.progress, 'ilva', SEED).buyback[0]).toMatchObject({
      key: 'sword',
      token,
    });
  });
});

describe('DA5c-2: the list ends with the game day', () => {
  function soldToday() {
    const token = unique();
    const start = heroWith([token]);
    return { token, sold: apply(start, sell(start)).aggregates };
  }

  it.each([
    ['UTC midnight', NEXT_DAY, {}],
    ['spent Will', NOON, { willSpent: GAME_DAY_RULES.willSpent }],
    ['completed quests', NOON, { questsCompleted: GAME_DAY_RULES.questsCompleted }],
    ['cave trips', NOON, { caveTrips: GAME_DAY_RULES.caveTrips }],
  ])('clears the entry and refuses the buy-back after %s', (_name, now, counters) => {
    const { token, sold } = soldToday();
    const ending = { ...sold, progress: { ...sold.progress } };
    ending.progress.day = { ...sold.progress.day!, ...counters };

    const stored = structuredClone(ending.progress);
    expect(held(projected(sold.progress))).toEqual(held(sold.progress));
    expect(projected(ending.progress, now).uniqueBuyback).toEqual({});
    expect(ending.progress).toEqual(stored);

    expect(refusal(ending, buyBack(ending, token), now)).toBe('BUY_BACK_GONE');

    const opened = trackGameDay(ending.progress, { progress: ending.progress, events: [] }, now);
    expect(opened.progress.uniqueBuyback).toEqual({});
    expect(opened.events).toEqual([
      expect.objectContaining({ type: 'GAME_DAY_STARTED' }),
      {
        type: 'UNIQUE_BUY_BACK_EXPIRED',
        payload: { heroId: HERO, dayId: 2, instanceIds: [token.instanceId] },
      },
    ]);

    const after = { ...ending, progress: opened.progress };
    expect(refusal(after, buyBack(after, token), now)).toBe('BUY_BACK_GONE');
    expect(bagTokens(after.inventory)).toEqual([]);
  });

  it('keeps a unique whose sale opens the new day and drops the one of the old day', () => {
    const [old, fresh] = [unique(0), unique(1)];
    const start = heroWith([old, fresh]);
    const first = apply(start, sell(start, 1)).aggregates;
    const index = first.inventory.bag.findIndex((item) => item?.token?.id === fresh.id);
    const second = apply(first, sell(first, index), NEXT_DAY).aggregates;
    expect(held(second.progress)).toMatchObject([{ token: fresh, dayId: 2 }]);
    const back = apply(second, buyBack(second, fresh), NEXT_DAY).aggregates;
    expect(bagTokens(back.inventory)).toEqual([fresh]);
  });

  it('keeps the list while the day runs', () => {
    const { sold } = soldToday();
    const spent = { type: 'WILL_SPENT', payload: { heroId: HERO, amount: 1, reason: 'step' } };
    const later = trackGameDay(sold.progress, { progress: sold.progress, events: [spent] }, NOON);
    expect(held(later.progress)).toEqual(held(sold.progress));
  });
});

describe('DA5c-3: a refused or repeated buy-back changes nothing', () => {
  it('refuses a hero short of one coin', () => {
    const token = unique();
    const start = heroWith([token], HERO, 0);
    const sold = apply(start, sell(start)).aggregates;
    const coins = sold.inventory.bag.findIndex((item) => item?.key === HEXOBJECT_KEYS.COINS);
    const purse = sold.inventory.bag[coins]!;
    const bag = sold.inventory.bag.slice();
    bag[coins] = { ...purse, amount: purse.amount - 1 };
    const poor = { ...sold, inventory: { ...sold.inventory, bag } };
    expect(refusal(poor, buyBack(poor, token))).toBe('NOT_ENOUGH_COINS');
    expect(refusal(poor, buyBack(poor, token))).toBe('NOT_ENOUGH_COINS');
  });

  it('has one effect when the same command comes twice', () => {
    const token = unique();
    const start = heroWith([token]);
    const sold = apply(start, sell(start)).aggregates;
    const command = buyBack(sold, token);
    const back = apply(sold, command).aggregates;
    expect(refusal(back, command)).toBe('INVENTORY_STALE');
    expect(refusal(back, buyBack(back, token))).toBe('BUY_BACK_GONE');
    expect(bagTokens(back.inventory)).toEqual([token]);
    expect(walletCoins(back.inventory)).toBe(START_COINS);
  });

  it('refuses a malformed instance id before any rule runs', () => {
    const payload = { heroId: HERO, revision: 0, trader: 'ilva', instanceId: 'lantern-eater' };
    const schema = PLAYER_COMMAND_SCHEMAS.SHOP_BUY_BACK_UNIQUE;
    expect(schema.safeParse({ type: 'SHOP_BUY_BACK_UNIQUE', payload }).success).toBe(false);
  });

  it('refuses a hero away from the stall', () => {
    const token = unique();
    const start = heroWith([token]);
    const sold = apply(start, sell(start)).aggregates;
    const outcome = executePlayerCommand(
      sold,
      PLAYER_COMMAND_SCHEMAS.SHOP_BUY_BACK_UNIQUE.parse(buyBack(sold, token)),
      {
        devGrantAllowed: false,
        inventory: { stashOpen: false, battleOpen: false },
        trade: { atTrader: null, rngSeed: SEED, dayId: 1 },
      },
    );
    expect(outcome).toMatchObject({ ok: false, code: 'NOT_AT_TRADER' });
  });
});

describe('DA5c-4: the list belongs to one hero', () => {
  it('shows nothing to another hero and refuses his buy-back', () => {
    const token = unique();
    const start = heroWith([token]);
    const sold = apply(start, sell(start)).aggregates;
    const other = heroWith([], OTHER, 100_000);
    const seen = projected(other.progress);

    expect(seen.uniqueBuyback).toEqual({});
    expect(refusal(other, buyBack(other, token, OTHER))).toBe('BUY_BACK_GONE');
    expect(refusal(sold, buyBack(sold, token, OTHER))).toBe('WRONG_HERO');
  });
});

describe('DA5c-5: progress schema 14', () => {
  it('loads a v13 save with an empty list and changes nothing else', () => {
    const v13: Record<string, unknown> = { ...emptyProgressState(HERO), steps: 41, trips: 2 };
    delete v13.uniqueBuyback;
    expect(upcastAggregate('progress', 13, v13, { heroId: HERO })).toEqual({
      ...v13,
      uniqueBuyback: {},
    });
  });

  it('round-trips a held instance and refuses a base token', () => {
    const token = unique();
    const start = heroWith([token]);
    const { progress } = apply(start, sell(start)).aggregates;
    const stored = JSON.parse(JSON.stringify(progress)) as ProgressState;
    expect(upcastAggregate('progress', 14, stored, { heroId: HERO })).toEqual(progress);

    const forged = {
      ...progress,
      uniqueBuyback: { ilva: [{ token: baseSword(), price: 1, dayId: 1 }] },
    };
    expect(AGGREGATES.progress.schema.safeParse(forged).success).toBe(false);
  });
});
