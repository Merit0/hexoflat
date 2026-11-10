import type { TEquipSlot } from '../abstraction/hexobject-abstraction';
import { hexobjectOfBattleItem } from '../battle/battle-catalogue';
import type { BattleCreature, BattleHand } from '../battle/battle-state';
import {
  mintItem,
  type InventoryState,
  type InventoryStateItem,
} from '../inventory/inventory-state';
import type { THexobjectKey } from '../registry/hexobjects-registry';

const SLOT_OF_HAND: Record<BattleHand, TEquipSlot> = { right: 'weapon', left: 'shield' };

function handItemKey(creature: BattleCreature, hand: BattleHand): THexobjectKey | null {
  const item = creature.hands[hand];
  return item ? (hexobjectOfBattleItem(item.key) as THexobjectKey | null) : null;
}

function freeBagCell(inventory: InventoryState): number {
  return inventory.bag.findIndex((cell) => cell === null);
}

function takeFromBag(inventory: InventoryState, key: THexobjectKey): InventoryStateItem | null {
  const index = inventory.bag.findIndex((cell) => cell?.key === key);
  if (index < 0) return null;
  const cell = inventory.bag[index]!;
  if (cell.amount <= 1) {
    inventory.bag[index] = null;
    return cell;
  }
  inventory.bag[index] = { ...cell, amount: cell.amount - 1 };
  return mintItem(inventory, key, 1);
}

function placeHand(inventory: InventoryState, slot: TEquipSlot, wanted: THexobjectKey | null) {
  const current = inventory.equip[slot];
  if (wanted === null) {
    if (!current) return true;
    const free = freeBagCell(inventory);
    if (free < 0) return false;
    inventory.bag[free] = current;
    inventory.equip[slot] = null;
    return true;
  }
  if (current?.key === wanted) return true;
  const incoming = takeFromBag(inventory, wanted);
  if (!incoming) return false;
  inventory.equip[slot] = incoming;
  if (!current) return true;
  const free = freeBagCell(inventory);
  if (free < 0) return false;
  inventory.bag[free] = current;
  return true;
}

export function syncHandsToInventory(
  inventory: InventoryState,
  before: BattleCreature,
  after: BattleCreature,
): InventoryState | null {
  const next = structuredClone(inventory);
  let changed = false;
  for (const hand of Object.keys(SLOT_OF_HAND) as BattleHand[]) {
    if ((before.hands[hand]?.key ?? null) === (after.hands[hand]?.key ?? null)) continue;
    if (!placeHand(next, SLOT_OF_HAND[hand], handItemKey(after, hand))) return null;
    changed = true;
  }
  if (changed) next.revision += 1;
  return next;
}
