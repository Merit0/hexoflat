import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import { STASH_CHEST_CELLS, stashChestPrice } from './stash-constants';
import type { IInventoryAggregate } from './transfer-types';

export type TUnlockChestError =
  'MAX_CHESTS' | 'CAMP_CHEST_NOT_CLAIMED' | 'NO_COINS_IN_HAND' | 'NOT_ENOUGH_COINS';

export type TUnlockChestResult =
  | { ok: true; next: IInventoryAggregate; chests: number; price: number }
  | { ok: false; reason: TUnlockChestError; price: number | null };

const HAND_SLOTS: readonly TEquipSlot[] = ['weapon', 'shield'];

export function coinsInHand(agg: IInventoryAggregate, slot: TEquipSlot): number {
  const item = agg.equip[slot];
  return item?.key === HEXOBJECT_KEYS.COINS ? item.amount : 0;
}

/** The hand holding the biggest stack of coins, or null when neither hand holds coins. */
export function coinHandSlot(agg: IInventoryAggregate): TEquipSlot | null {
  let best: TEquipSlot | null = null;
  for (const slot of HAND_SLOTS) {
    if (coinsInHand(agg, slot) > (best ? coinsInHand(agg, best) : 0)) best = slot;
  }
  return best;
}

/**
 * Unlocks the next chest in order by paying exactly its price out of the coins held in a hand;
 * whatever is left stays in that hand. Coins in the bag or the stash never count.
 */
export function planUnlockStashChest(
  agg: IInventoryAggregate,
  owned: number,
  slot: TEquipSlot,
): TUnlockChestResult {
  if (owned === 0) return { ok: false, reason: 'CAMP_CHEST_NOT_CLAIMED', price: 0 };
  const price = stashChestPrice(owned);
  if (price === null) return { ok: false, reason: 'MAX_CHESTS', price };
  const held = coinsInHand(agg, slot);
  if (held === 0) return { ok: false, reason: 'NO_COINS_IN_HAND', price };
  if (held < price) return { ok: false, reason: 'NOT_ENOUGH_COINS', price };
  const hand = agg.equip[slot];
  const left = held - price;
  const equip = { ...agg.equip, [slot]: hand && left > 0 ? { ...hand, amount: left } : null };
  const fresh = Array.from({ length: STASH_CHEST_CELLS }, () => null);
  return {
    ok: true,
    next: { ...agg, equip, stash: [...agg.stash, ...fresh] },
    chests: owned + 1,
    price,
  };
}
