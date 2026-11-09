import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { getMeta, getPrototype } from '../content/content-accessors';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { canFitAdditionalWeight, getItemUnitWeightKg } from '../utils/inventory/traits-resolver';
import { EQUIP_SLOTS } from '../abstraction/hexobject-abstraction';
import type { TItemLocation } from './item-location';
import { carriedWeightKg } from './item-queries';
import type { IInventoryAggregate } from './transfer-types';

export type TGrantError = 'UNKNOWN_ITEM' | 'NOT_STORABLE' | 'TOO_HEAVY' | 'BAG_FULL';
export type TConsumeError = 'UNKNOWN_ITEM' | 'NOT_ENOUGH';

export type TGrantResult =
  | { ok: true; next: IInventoryAggregate; placedAt: TItemLocation[] }
  | { ok: false; reason: TGrantError };

export type TConsumeResult =
  { ok: true; next: IInventoryAggregate } | { ok: false; reason: TConsumeError };

const KNOWN_KEYS: ReadonlySet<string> = new Set(Object.values(HEXOBJECT_KEYS));

function stackRules(key: THexobjectKey) {
  const traits = getMeta(key)?.traits;
  const stackable = !!traits?.stackable;
  return {
    stackable,
    stackKey: stackable ? (traits?.stackKey ?? key) : undefined,
    maxStack: traits?.maxStack ?? null,
  };
}

function newItem(
  key: THexobjectKey,
  stackKey: string | undefined,
  amount: number,
  id: string,
): InventoryItem {
  return {
    id,
    key,
    type: getPrototype(key).groupType,
    stackKey,
    amount,
    slotKey: '',
    isNew: true,
  };
}

/**
 * Adds `amount` of `key` as the hero picks it up: tops up unfinished stacks (bag first, then
 * the hands), then fills free bag cells in order. Atomic: when the weight limit or the room
 * runs out nothing changes at all (the legacy store could leave half a stack behind). A
 * non-stackable item arrives one piece per cell.
 */
export function planGrant(
  agg: IInventoryAggregate,
  key: THexobjectKey,
  amount: number,
  capacityKg: number,
  newId: () => string,
): TGrantResult {
  if (!KNOWN_KEYS.has(key)) return { ok: false, reason: 'UNKNOWN_ITEM' };
  if (key === HEXOBJECT_KEYS.HAND) return { ok: false, reason: 'NOT_STORABLE' };
  const incoming = getItemUnitWeightKg(key) * amount;
  if (!canFitAdditionalWeight(carriedWeightKg(agg), capacityKg, incoming)) {
    return { ok: false, reason: 'TOO_HEAVY' };
  }

  const { stackable, stackKey, maxStack } = stackRules(key);
  const bag = agg.bag.slice();
  const equip = { ...agg.equip };
  const placedAt: TItemLocation[] = [];
  let left = amount;

  const topUp = (item: InventoryItem): InventoryItem => {
    const room = maxStack === null ? left : Math.max(0, maxStack - item.amount);
    const add = Math.min(room, left);
    left -= add;
    return add > 0 ? { ...item, amount: item.amount + add } : item;
  };

  if (stackable) {
    bag.forEach((item, index) => {
      if (!item || item.stackKey !== stackKey || left <= 0) return;
      const next = topUp(item);
      if (next !== item) {
        bag[index] = next;
        placedAt.push({ container: 'bag', index });
      }
    });
    for (const slot of EQUIP_SLOTS) {
      const item = equip[slot];
      if (!item || item.stackKey !== stackKey || left <= 0) continue;
      const next = topUp(item);
      if (next !== item) {
        equip[slot] = next;
        placedAt.push({ container: 'equip', slot });
      }
    }
  }

  while (left > 0) {
    const index = bag.findIndex((cell) => cell === null);
    if (index === -1) return { ok: false, reason: 'BAG_FULL' };
    const chunk = stackable ? (maxStack === null ? left : Math.min(left, maxStack)) : 1;
    bag[index] = newItem(key, stackKey, chunk, newId());
    placedAt.push({ container: 'bag', index });
    left -= chunk;
  }

  return { ok: true, next: { ...agg, bag, equip }, placedAt };
}

export function countItem(agg: IInventoryAggregate, key: THexobjectKey): number {
  const held = [...agg.bag, ...EQUIP_SLOTS.map((slot) => agg.equip[slot])];
  return held.reduce((sum, item) => (item?.key === key ? sum + item.amount : sum), 0);
}

/** Takes `amount` of `key` from the bag first, then the hands; an emptied stack leaves its cell. */
export function planConsume(
  agg: IInventoryAggregate,
  key: THexobjectKey,
  amount: number,
): TConsumeResult {
  if (!KNOWN_KEYS.has(key)) return { ok: false, reason: 'UNKNOWN_ITEM' };
  if (countItem(agg, key) < amount) return { ok: false, reason: 'NOT_ENOUGH' };
  let left = amount;
  const take = (item: InventoryItem | null): InventoryItem | null => {
    if (!item || item.key !== key || left <= 0) return item;
    const taken = Math.min(item.amount, left);
    left -= taken;
    return item.amount - taken > 0 ? { ...item, amount: item.amount - taken } : null;
  };
  const bag = agg.bag.map(take);
  const equip = { ...agg.equip };
  for (const slot of EQUIP_SLOTS) equip[slot] = take(equip[slot]);
  return { ok: true, next: { ...agg, bag, equip } };
}
