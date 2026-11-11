import type { DomainEvent } from '../commands/types';
import type { TTraderKey } from '../content/traders.content';
import type { InventoryContext } from '../inventory/inventory-commands';
import type { InventoryState } from '../inventory/inventory-state';
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
  const { heroId, trader, expectedPrice } = command.payload;
  const result = planRefresh(progress, trader, { rngSeed: trade.rngSeed, expectedPrice });
  if (!result.ok) return rejected(command, result.reason, result.price);
  result.progress.knowledge.revision += 1;
  const refreshed: DomainEvent = {
    type: 'TRADER_REFRESHED',
    payload: { heroId, trader, serial: result.serial, willPrice: result.price },
  };
  return { changed: { progress: result.progress }, events: [...result.events, refreshed] };
}

export function applyTradeCommand(
  aggregates: { inventory: InventoryState; progress: ProgressState },
  command: ShopCommand,
  ctx: { inventory: InventoryContext; trade?: TradeContext },
): TradeApplyResult {
  const trade = ctx.trade ?? { atTrader: null, rngSeed: '' };
  const input: TradeInput = { ...aggregates, command, trade };
  const refusal = guardRefusal(input, ctx.inventory);
  if (refusal) return rejected(command, refusal);
  if (command.type === 'SHOP_REFRESH') return runRefresh({ ...input, command });

  const { trader, expectedPrice, split, amount } = command.payload;
  const ref = { key: trader, state: traderView(input.progress, trader, trade.rngSeed) };
  const opts = { split, expectedPrice, amount };
  const result =
    command.type === 'SHOP_BUY'
      ? planBuy(input.inventory, ref, command.payload.from, command.payload.to, opts)
      : planSell(input.inventory, ref, command.payload.from.index, opts);
  return dealOutcome(input, result);
}
