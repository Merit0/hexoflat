import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { coinPriceOf } from '../content/content-accessors';
import { TRADERS } from '../content/traders.content';
import { applyAggregate, toAggregate } from '../inventory/inventory-adapter';
import type { InventoryState } from '../inventory/inventory-state';
import { canStackTogether, exceedsCapacity, stackLimit } from '../inventory/item-queries';
import { halfOf, placeInto } from '../inventory/placement';
import type { IInventoryAggregate, TItemCells } from '../inventory/transfer-types';
import { freshPiece, payCoins, sequenceOf } from './coin-purse';
import { readSource, takeFromSource } from './trade-lists';
import type {
  ITradeOptions,
  ITradeSource,
  ITraderRef,
  TBuyTarget,
  TTradeError,
  TTradeResult,
} from './trade-types';
import { walletCoins } from './trader-view';

type TPlaced = { cells: TItemCells } | { error: TTradeError };

function wanted(
  amount: number,
  piece: InventoryItem,
  opts: Pick<ITradeOptions, 'split' | 'amount'>,
): number {
  if (opts.amount !== undefined) return Math.min(amount, opts.amount);
  const split = opts.split;
  return split && amount > 1 && stackLimit(piece) !== null ? halfOf({ ...piece, amount }) : amount;
}

function roomAt(bag: TItemCells, to: TBuyTarget, piece: InventoryItem): number | null {
  if (to === 'auto') return null;
  const dst = bag[to.index];
  if (!dst || !canStackTogether(dst, piece)) return null;
  return (stackLimit(dst) ?? 0) - dst.amount;
}

function placeBought(bag: TItemCells, to: TBuyTarget, piece: InventoryItem): TPlaced {
  if (to === 'auto') {
    const cells = placeInto(bag, piece);
    return cells ? { cells } : { error: 'CONTAINER_FULL' };
  }
  const dst = bag[to.index];
  const cells = bag.slice();
  if (!dst) {
    cells[to.index] = piece;
    return { cells };
  }
  if (!canStackTogether(dst, piece)) return { error: 'SPLIT_TARGET_TAKEN' };
  if ((stackLimit(dst) ?? 0) - dst.amount <= 0) return { error: 'STACK_FULL' };
  cells[to.index] = { ...dst, amount: dst.amount + piece.amount };
  return { cells };
}

function refuse(reason: TTradeError, price: number | null = null): TTradeResult {
  return { ok: false, reason, price };
}

export function planBuy(
  inventory: InventoryState,
  trader: ITraderRef,
  from: ITradeSource,
  to: TBuyTarget,
  opts: ITradeOptions,
): TTradeResult {
  const entry = readSource(trader.state, from);
  if (!entry) return refuse('EMPTY_SOURCE');
  if (to !== 'auto' && (to.index < 0 || to.index >= inventory.bag.length)) {
    return refuse('CONTAINER_FULL');
  }
  const unit = 'unitPrice' in entry ? entry.unitPrice : coinPriceOf(entry.key);
  if (unit === null) return refuse('NOT_TRADEABLE');

  const seq = sequenceOf(inventory);
  const sample = freshPiece({ ...seq }, entry.key, 1);
  const agg: IInventoryAggregate = toAggregate(inventory);
  const want = wanted(entry.amount, sample, opts);
  const room = roomAt(agg.bag, to, sample);
  const amount = room !== null && room > 0 ? Math.min(room, want) : want;
  const price = unit * amount;
  if (price !== opts.expectedPrice) return refuse('PRICE_CHANGED', price);
  if (walletCoins(inventory) < price) return refuse('NOT_ENOUGH_COINS', price);

  const paid = payCoins(agg, price);
  if (!paid) return refuse('NOT_ENOUGH_COINS', price);
  const piece = freshPiece(seq, entry.key, amount);
  const placed = placeBought(paid.bag, to, piece);
  if ('error' in placed) return refuse(placed.error, price);
  const next = { ...paid, bag: placed.cells };
  if (exceedsCapacity(agg, next, inventory.capacityKg)) return refuse('OVERWEIGHT', price);

  const idSeq = placed.cells.some((cell) => cell?.id === piece.id) ? seq.idSeq : inventory.idSeq;
  return {
    ok: true,
    inventory: { ...applyAggregate(inventory, next), idSeq },
    trader: takeFromSource(trader.state, from, amount, TRADERS[trader.key]),
    key: entry.key,
    amount,
    price,
  };
}
