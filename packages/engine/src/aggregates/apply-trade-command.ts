import type { DomainEvent } from '../commands/types';
import type { TTraderKey } from '../content/traders.content';
import type { InventoryContext } from '../inventory/inventory-commands';
import type { InventoryState } from '../inventory/inventory-state';
import { planList, planReprice, planUnlist } from '../trade/plan-listing';
import { planDeal } from '../trade/plan-deal';
import { planBuy } from '../trade/plan-buy';
import { planRefresh } from '../trade/plan-refresh';
import { planSell } from '../trade/plan-sell';
import type { ShopCommand } from '../trade/trade-commands';
import type { TTradeResult } from '../trade/trade-types';
import { traderView } from '../trade/trader-view';
import type { ProgressState } from './progress-state';

export interface TradeContext {
  atTrader: TTraderKey | null;
  rngSeed: string;
}

export interface TradeApplyResult {
  changed: { inventory?: InventoryState; progress?: ProgressState };
  events: DomainEvent[];
}

interface TradeInput {
  inventory: InventoryState;
  progress: ProgressState;
  command: ShopCommand;
  trade: TradeContext;
}

function rejected(
  command: ShopCommand,
  reason: string,
  price: number | null = null,
): TradeApplyResult {
  const { heroId, trader } = command.payload;
  const payload = { heroId, trader, command: command.type, reason, price };
  return { changed: {}, events: [{ type: 'TRADE_REJECTED', payload }] };
}

function guardRefusal(input: TradeInput, inventoryContext: InventoryContext): string | null {
  const { command, inventory, progress, trade } = input;
  const { heroId, revision, trader } = command.payload;
  if (command.type === 'SHOP_REFRESH') {
    if (heroId !== progress.knowledge.heroId) return 'WRONG_HERO';
    if (revision !== progress.knowledge.revision) return 'STALE_REVISION';
  } else {
    if (heroId !== inventory.heroId) return 'WRONG_HERO';
    if (revision !== inventory.revision) return 'INVENTORY_STALE';
  }
  if (trade.atTrader !== trader) return 'NOT_AT_TRADER';
  if (inventoryContext.battleOpen) return 'BATTLE_OPEN';
  return null;
}

function dealOutcome(input: TradeInput, result: TTradeResult): TradeApplyResult {
  const { command, inventory, progress } = input;
  if (!result.ok) return rejected(command, result.reason, result.price);
  const { heroId, trader } = command.payload;
  const revision = inventory.revision + 1;
  const deal = { heroId, trader, key: result.key, amount: result.amount, price: result.price };
  const event: DomainEvent =
    command.type === 'SHOP_BUY'
      ? { type: 'ITEM_BOUGHT', payload: { ...deal, from: command.payload.from.list } }
      : { type: 'ITEM_SOLD', payload: deal };
  return {
    changed: {
      inventory: { ...result.inventory, revision },
      progress: { ...progress, traders: { ...progress.traders, [trader]: result.trader } },
    },
    events: [event, { type: 'INVENTORY_CHANGED', payload: { heroId, revision } }],
  };
}

function runRefresh(input: TradeInput & { command: { type: 'SHOP_REFRESH' } }): TradeApplyResult {
  const { command, progress, trade } = input;
  const { heroId, trader, expectedPrice, free } = command.payload;
  const result = planRefresh(progress, trader, { rngSeed: trade.rngSeed, expectedPrice, free });
  if (!result.ok) return rejected(command, result.reason, result.price);
  result.progress.knowledge.revision += 1;
  const refreshed: DomainEvent = {
    type: 'TRADER_REFRESHED',
    payload: { heroId, trader, serial: result.serial, willPrice: result.price },
  };
  return { changed: { progress: result.progress }, events: [...result.events, refreshed] };
}

function runDeal(input: TradeInput & { command: { type: 'SHOP_DEAL' } }): TradeApplyResult {
  const { command, inventory, progress, trade } = input;
  const { heroId, trader, index, guess, to } = command.payload;
  const ref = { key: trader, state: traderView(progress, trader, trade.rngSeed) };
  const deal = planDeal(inventory, ref, index, to, guess);
  if (deal.kind === 'refused') return rejected(command, deal.result.reason, deal.result.price);
  const revision = inventory.revision + 1;
  const changedInventory = {
    ...(deal.kind === 'bought' ? deal.result.inventory : inventory),
    revision,
  };
  const nextTrader = deal.kind === 'bought' ? deal.result.trader : deal.trader;
  const outcome: DomainEvent =
    deal.kind === 'bought'
      ? {
          type: 'ITEM_BOUGHT',
          payload: {
            heroId,
            trader,
            key: deal.result.key,
            amount: deal.result.amount,
            price: deal.result.price,
            from: 'goods',
            discounted: true,
            saved: deal.saved,
          },
        }
      : { type: 'DEAL_WASTED', payload: { heroId, trader, key: deal.key, index } };
  return {
    changed: {
      inventory: changedInventory,
      progress: { ...progress, traders: { ...progress.traders, [trader]: nextTrader } },
    },
    events: [outcome, { type: 'INVENTORY_CHANGED', payload: { heroId, revision } }],
  };
}

function runListing(
  input: TradeInput & { command: { type: 'SHOP_LIST' | 'SHOP_UNLIST' | 'SHOP_REPRICE' } },
): TradeApplyResult {
  const { command, inventory, progress } = input;
  const { heroId, trader } = command.payload;
  const revision = inventory.revision + 1;
  const store = (next: Partial<ProgressState>, nextInventory = inventory) => ({
    inventory: { ...nextInventory, revision },
    progress: { ...progress, ...next },
  });
  const tail: DomainEvent = { type: 'INVENTORY_CHANGED', payload: { heroId, revision } };

  if (command.type === 'SHOP_REPRICE') {
    const { slot, unitPrice } = command.payload;
    const result = planReprice(progress.listings, slot, unitPrice);
    if (!result.ok) return rejected(command, result.reason);
    const key = progress.listings[slot]!.key;
    const event: DomainEvent = {
      type: 'LISTING_REPRICED',
      payload: { heroId, trader, slot, key, unitPrice },
    };
    return { changed: store({ listings: result.listings }), events: [event, tail] };
  }

  const result =
    command.type === 'SHOP_LIST'
      ? planList(
          inventory,
          progress.listings,
          command.payload.from.index,
          command.payload.unitPrice,
          command.payload.amount,
        )
      : planUnlist(inventory, progress.listings, command.payload.slot);
  if (!result.ok) return rejected(command, result.reason);
  const payload = {
    heroId,
    trader,
    slot: result.slot,
    key: result.key,
    amount: result.amount,
    unitPrice: result.unitPrice,
  };
  const event: DomainEvent = {
    type: command.type === 'SHOP_LIST' ? 'ITEM_LISTED' : 'ITEM_UNLISTED',
    payload,
  };
  return {
    changed: store({ listings: result.listings }, result.inventory),
    events: [event, tail],
  };
}

export function applyTradeCommand(
  aggregates: { inventory: InventoryState; progress: ProgressState },
  command: ShopCommand,
  ctx: { inventory: InventoryContext; trade?: TradeContext; devGrantAllowed?: boolean },
): TradeApplyResult {
  const trade = ctx.trade ?? { atTrader: null, rngSeed: '' };
  const input: TradeInput = { ...aggregates, command, trade };
  const refusal = guardRefusal(input, ctx.inventory);
  if (refusal) return rejected(command, refusal);
  if (command.type === 'SHOP_REFRESH' && command.payload.free && !ctx.devGrantAllowed) {
    return rejected(command, 'FREE_REFRESH_NOT_ALLOWED');
  }
  if (command.type === 'SHOP_REFRESH') return runRefresh({ ...input, command });
  if (command.type === 'SHOP_DEAL') return runDeal({ ...input, command });
  if (
    command.type === 'SHOP_LIST' ||
    command.type === 'SHOP_UNLIST' ||
    command.type === 'SHOP_REPRICE'
  ) {
    return runListing({ ...input, command });
  }

  const { trader, expectedPrice, split, amount } = command.payload;
  const ref = { key: trader, state: traderView(input.progress, trader, trade.rngSeed) };
  const opts = { split, expectedPrice, amount };
  const result =
    command.type === 'SHOP_BUY'
      ? planBuy(input.inventory, ref, command.payload.from, command.payload.to, opts)
      : planSell(input.inventory, ref, command.payload.from.index, opts);
  return dealOutcome(input, result);
}
