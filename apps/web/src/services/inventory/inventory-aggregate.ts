import { EQUIP_SLOTS, type TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type {
  IInventoryAggregate,
  TEquipment,
  TItemCells,
} from '@hexoflat/engine/inventory/item-transfer';

const EQUIP_PREFIX = 'eq:';

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
