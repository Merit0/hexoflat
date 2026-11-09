import { battleItemOfHexobject } from '../battle/battle-catalogue';
import type { InventoryState } from '../inventory/inventory-state';
import type { HeroLoadout } from './squad-battle';

export const BATTLE_BAG_LIMIT = 3;

function handKey(item: { key: string } | null): string | null {
  return item && battleItemOfHexobject(item.key) ? item.key : null;
}

export function loadoutFromInventory(
  inventory: InventoryState,
  hearts: number,
  maxHearts?: number,
): HeroLoadout {
  const bag = inventory.bag
    .flatMap((item) =>
      item && battleItemOfHexobject(item.key)
        ? Array.from({ length: Math.max(1, item.amount) }, () => item.key as string)
        : [],
    )
    .slice(0, BATTLE_BAG_LIMIT);
  return {
    id: inventory.heroId,
    hearts,
    maxHearts,
    weapon: handKey(inventory.equip.weapon),
    shield: handKey(inventory.equip.shield),
    bag,
  };
}
