import { EQUIP_SLOTS, type TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type {
  IInventoryAggregate,
  TEquipment,
  TItemCells,
} from '@hexoflat/engine/inventory/item-transfer';

export interface BagGrid {
  cols: number;
  rows: number;
  blockedRect: { x: number; y: number; w: number; h: number };
}

const EQUIP_PREFIX = 'eq:';
const STASH_PREFIX = 'stash:';

export function bagSlotKeys(grid: BagGrid, willSlotKey: string): string[] {
  const { x, y, w, h } = grid.blockedRect;
  const keys: string[] = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const blocked = col >= x && col < x + w && row >= y && row < y + h;
      const key = `r${row}c${col}`;
      if (!blocked && key !== willSlotKey) keys.push(key);
    }
  }
  return keys;
}

export function equipSlotKeyOf(slot: TEquipSlot): string {
  return `${EQUIP_PREFIX}${slot}`;
}

function isBareHand(item: InventoryItem | undefined): boolean {
  return item?.key === HEXOBJECT_KEYS.HAND;
}

export function toAggregate(
  items: InventoryItem[],
  stash: TItemCells,
  slotKeys: string[],
): IInventoryAggregate {
  const bySlot = new Map(items.map((item) => [item.slotKey, item]));
  const equip = {} as TEquipment;
  for (const slot of EQUIP_SLOTS) {
    const worn = bySlot.get(equipSlotKeyOf(slot));
    equip[slot] = worn && !isBareHand(worn) ? worn : null;
  }
  return { bag: slotKeys.map((key) => bySlot.get(key) ?? null), equip, stash };
}

export interface AppliedAggregate {
  items: InventoryItem[];
  stash: TItemCells;
}

/**
 * The inverse of `toAggregate`. Bare hands stay where they were, items nobody addressed (a
 * stray slot key) are carried over untouched, and every item gets the slot key of its new cell.
 */
export function fromAggregate(
  agg: IInventoryAggregate,
  previous: InventoryItem[],
  slotKeys: string[],
): AppliedAggregate {
  const items: InventoryItem[] = [];
  agg.bag.forEach((item, index) => {
    if (item) items.push({ ...item, slotKey: slotKeys[index] });
  });
  for (const slot of EQUIP_SLOTS) {
    const worn = agg.equip[slot];
    if (worn) {
      items.push({ ...worn, slotKey: equipSlotKeyOf(slot) });
      continue;
    }
    const hand = previous.find((item) => item.slotKey === equipSlotKeyOf(slot) && isBareHand(item));
    if (hand) items.push(hand);
  }
  const addressed = new Set([...slotKeys, ...EQUIP_SLOTS.map(equipSlotKeyOf)]);
  items.push(...previous.filter((item) => !addressed.has(item.slotKey)));
  const stash = agg.stash.map((item, index) =>
    item ? { ...item, slotKey: `${STASH_PREFIX}${index}` } : null,
  );
  return { items, stash };
}
