import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { emptyInventoryState } from '../inventory/inventory-state';
import { upcastToken } from '../inventory/upcast-item-tokens';

// Owned legacy tokens keep their attributes even when that type cannot roll them now.
export function fogInventory(value: number, equipped = true) {
  const inventory = emptyInventoryState('hero-1');
  const item = {
    id: 'hero-1:helm',
    key: 'shield' as const,
    type: EHexobjectGroup.EQUIPMENT,
    amount: 1,
    token: {
      ...upcastToken('hero-1', 'equip.helm', 'shield')!,
      attributes: [{ key: 'fog', value }],
    },
  };
  if (equipped) inventory.equip.helm = item;
  else inventory.bag[0] = item;
  return inventory;
}
