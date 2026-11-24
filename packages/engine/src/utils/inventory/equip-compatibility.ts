import type { InventoryItem } from '../../abstraction/inventory-abstraction';
import { EHexobjectGroup, type TEquipSlot } from '../../abstraction/hexobject-abstraction';
import { itemSlotOf } from '../../tokens/tool-action';

export type TEquipCompatibility = 'effect' | 'mismatch';

function isHandSlot(slot: TEquipSlot) {
  return slot === 'weapon' || slot === 'shield';
}

function canUseInHand(item: InventoryItem) {
  return (
    item.type !== EHexobjectGroup.CREATURE &&
    item.type !== EHexobjectGroup.CONSTRUCTION &&
    item.type !== EHexobjectGroup.EQUIPMENT
  );
}

export function resolveEquipCompatibility(
  item: InventoryItem | null,
  slot: TEquipSlot,
): TEquipCompatibility {
  if (!item || !isHandSlot(slot)) return 'mismatch';

  return itemSlotOf(item.key) || canUseInHand(item) ? 'effect' : 'mismatch';
}
