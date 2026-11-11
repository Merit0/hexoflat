import { TRADERS } from '../content/traders.content';
import { applyAggregate, toAggregate } from '../inventory/inventory-adapter';
import type { InventoryState } from '../inventory/inventory-state';
import { exceedsCapacity } from '../inventory/item-queries';
import { canSplit, halfOf, placeInto } from '../inventory/placement';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { freshPiece, sequenceOf } from './coin-purse';
import { addToBuyback } from './trade-lists';
import type { ITradeOptions, ITraderRef, TTradeError, TTradeResult } from './trade-types';
import { sellUnitPrice } from './trader-view';

function refuse(reason: TTradeError, price: number | null = null): TTradeResult {
  return { ok: false, reason, price };
}

export function planSell(
  inventory: InventoryState,
  trader: ITraderRef,
  fromBagIndex: number,
  opts: ITradeOptions,
): TTradeResult {
  const agg = toAggregate(inventory);
  const item = agg.bag[fromBagIndex];
  if (!item) return refuse('EMPTY_SOURCE');
  const def = TRADERS[trader.key];
  const unit = sellUnitPrice(def, item.key);
  if (unit === null) return refuse('NOT_TRADEABLE');
  const amount =
    opts.amount !== undefined
      ? Math.min(item.amount, opts.amount)
      : opts.split && canSplit(item)
        ? halfOf(item)
        : item.amount;
  const price = unit * amount;
  if (price !== opts.expectedPrice) return refuse('PRICE_CHANGED', price);

  const bag = agg.bag.slice();
  bag[fromBagIndex] = item.amount > amount ? { ...item, amount: item.amount - amount } : null;
  const seq = sequenceOf(inventory);
  const coins = freshPiece(seq, HEXOBJECT_KEYS.COINS, price);
  const paidOut = placeInto(bag, coins);
  if (!paidOut) return refuse('CONTAINER_FULL', price);
  const next = { ...agg, bag: paidOut };
  if (exceedsCapacity(agg, next, inventory.capacityKg)) return refuse('OVERWEIGHT', price);

  const idSeq = paidOut.some((cell) => cell?.id === coins.id) ? seq.idSeq : inventory.idSeq;
  const sold = { key: item.key, amount, unitPrice: unit };
  return {
    ok: true,
    inventory: { ...applyAggregate(inventory, next), idSeq },
    trader: {
      ...trader.state,
      buyback: addToBuyback(trader.state.buyback, sold, def.buybackSlots),
    },
    key: item.key,
    amount,
    price,
  };
}
