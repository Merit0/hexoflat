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

  const typeSlot = itemSlotOf(item.key);
  if (typeSlot) return typeSlot === 'any' || typeSlot === slot ? 'effect' : 'mismatch';

  return canUseInHand(item) ? 'effect' : 'mismatch';
}
