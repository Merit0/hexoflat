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

function takeFromBag(
  inventory: InventoryState,
  key: THexobjectKey,
  tokenId?: string,
): InventoryStateItem | null {
  const index = inventory.bag.findIndex(
    (cell) => cell?.key === key && (!tokenId || cell.token?.id === tokenId),
  );
  if (index < 0) return null;
  const cell = inventory.bag[index]!;
  if (cell.amount <= 1) {
    inventory.bag[index] = null;
    return cell;
  }
  inventory.bag[index] = { ...cell, amount: cell.amount - 1 };
  return mintItem(inventory, key, 1);
}

export function syncHandsToInventory(
  inventory: InventoryState,
  before: BattleCreature,
  after: BattleCreature,
): InventoryState | null {
  const next = structuredClone(inventory);
  const changed = (Object.keys(SLOT_OF_HAND) as BattleHand[]).filter(
    (hand) => (before.hands[hand]?.key ?? null) !== (after.hands[hand]?.key ?? null),
  );
  const stowed: InventoryStateItem[] = [];
  for (const hand of changed) {
    const slot = SLOT_OF_HAND[hand];
    const outgoing = next.equip[slot];
    if (outgoing) stowed.push(outgoing);
    next.equip[slot] = null;
  }
  for (const hand of changed) {
    const key = handItemKey(after, hand);
    if (!key) continue;
    const tokenId = after.hands[hand]?.token?.id;
    const held = stowed.findIndex(
      (item) => item.key === key && (!tokenId || item.token?.id === tokenId),
    );
    const incoming = held >= 0 ? stowed.splice(held, 1)[0] : takeFromBag(next, key, tokenId);
    if (!incoming) return null;
    next.equip[SLOT_OF_HAND[hand]] = incoming;
  }
  for (const item of stowed) {
    const free = freeBagCell(next);
    if (free < 0) return null;
    next.bag[free] = item;
  }
  if (changed.length > 0) next.revision += 1;
  return next;
}

export function restoreHandTokens(creature: BattleCreature, inventory: InventoryState): void {
  for (const hand of Object.keys(SLOT_OF_HAND) as BattleHand[]) {
    const item = creature.hands[hand];
    if (!item) continue;
    const token = inventory.equip[SLOT_OF_HAND[hand]]?.token;
    if (token) item.token = structuredClone(token);
    else delete item.token;
  }
}
