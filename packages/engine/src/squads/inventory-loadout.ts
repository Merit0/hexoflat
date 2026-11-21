import { battleItemOfHexobject } from '../battle/battle-catalogue';
import type { InventoryState } from '../inventory/inventory-state';
import type { HeroLoadout } from './squad-battle';
import type { BattleEquipment } from '../battle/battle-state';

export const BATTLE_BAG_LIMIT = 3;

function loadoutItem(item: BattleEquipment): BattleEquipment {
  return { key: item.key, ...(item.token ? { token: structuredClone(item.token) } : {}) };
}

function handItem(item: BattleEquipment | null): BattleEquipment | null {
  return item && battleItemOfHexobject(item.key) ? loadoutItem(item) : null;
}

export function loadoutFromInventory(
  inventory: InventoryState,
  hearts: number,
  maxHearts?: number,
): HeroLoadout {
  const bag = inventory.bag
    .flatMap((item) =>
      item && battleItemOfHexobject(item.key)
        ? Array.from({ length: Math.max(1, item.amount) }, () => loadoutItem(item))
        : [],
    )
    .slice(0, BATTLE_BAG_LIMIT);
  return {
    id: inventory.heroId,
    hearts,
    maxHearts,
    weapon: handItem(inventory.equip.weapon),
    shield: handItem(inventory.equip.shield),
    equipment: Object.entries(inventory.equip).flatMap(([slot, item]) =>
      slot !== 'weapon' && slot !== 'shield' && item ? [loadoutItem(item)] : [],
    ),
    bag,
  };
}
