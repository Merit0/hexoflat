import { coinPriceOf } from '../content/content-accessors';
import { applyAggregate, toAggregate } from '../inventory/inventory-adapter';
import type { InventoryState } from '../inventory/inventory-state';
import { exceedsCapacity } from '../inventory/item-queries';
import { placeInto } from '../inventory/placement';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { freshPiece, sequenceOf } from './coin-purse';
import { LISTING_MAX_PRICE, type Listings } from './listing-state';
import type { TTradeError } from './trade-types';

export type TListingResult =
  | {
      ok: true;
      inventory: InventoryState;
      listings: Listings;
      key: THexobjectKey;
      amount: number;
      unitPrice: number;
      slot: number;
    }
  | { ok: false; reason: TTradeError };

function refuse(reason: TTradeError): TListingResult {
  return { ok: false, reason };
}

function validPrice(unitPrice: number): boolean {
  return Number.isInteger(unitPrice) && unitPrice >= 1 && unitPrice <= LISTING_MAX_PRICE;
}

export function planList(
  inventory: InventoryState,
  listings: Listings,
  fromBagIndex: number,
  unitPrice: number,
  wanted?: number,
): TListingResult {
  if (!validPrice(unitPrice)) return refuse('BAD_PRICE');
  const agg = toAggregate(inventory);
  const item = agg.bag[fromBagIndex];
  if (!item) return refuse('EMPTY_SOURCE');
  if (coinPriceOf(item.key) === null) return refuse('NOT_TRADEABLE');
  const slot = listings.findIndex((cell) => cell === null);
  if (slot === -1) return refuse('TRADE_SLOTS_FULL');

  const amount = Math.min(item.amount, wanted ?? item.amount);
  const bag = agg.bag.slice();
  bag[fromBagIndex] = item.amount > amount ? { ...item, amount: item.amount - amount } : null;
  const next = listings.slice();
  next[slot] = { key: item.key, amount, unitPrice };
  return {
    ok: true,
    inventory: applyAggregate(inventory, { ...agg, bag }),
    listings: next,
    key: item.key,
    amount,
    unitPrice,
    slot,
  };
}

export function planUnlist(
  inventory: InventoryState,
  listings: Listings,
  slot: number,
): TListingResult {
  const listing = listings[slot] ?? null;
  if (!listing) return refuse('EMPTY_SOURCE');
  const agg = toAggregate(inventory);
  const seq = sequenceOf(inventory);
  const piece = freshPiece(seq, listing.key, listing.amount);
  const cells = placeInto(agg.bag, piece);
  if (!cells) return refuse('CONTAINER_FULL');
  const next = { ...agg, bag: cells };
  if (exceedsCapacity(agg, next, inventory.capacityKg)) return refuse('OVERWEIGHT');
  const idSeq = cells.some((cell) => cell?.id === piece.id) ? seq.idSeq : inventory.idSeq;
  const remaining = listings.slice();
  remaining[slot] = null;
  return {
    ok: true,
    inventory: { ...applyAggregate(inventory, next), idSeq },
    listings: remaining,
    key: listing.key,
    amount: listing.amount,
    unitPrice: listing.unitPrice,
    slot,
  };
}

export function planReprice(
  listings: Listings,
  slot: number,
  unitPrice: number,
): { ok: true; listings: Listings } | { ok: false; reason: TTradeError } {
  if (!validPrice(unitPrice)) return { ok: false, reason: 'BAD_PRICE' };
  const listing = listings[slot] ?? null;
  if (!listing) return { ok: false, reason: 'EMPTY_SOURCE' };
  const next = listings.slice();
  next[slot] = { ...listing, unitPrice };
  return { ok: true, listings: next };
}
