import { EQUIP_SLOTS, type TEquipSlot } from '@hexoflat/engine/abstraction/hexobject-abstraction';
import { BAG_WILL_SLOT_KEY, bagIndexOfSlotKey } from '@hexoflat/engine/inventory/bag-layout';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { dispatchInventory, type InventoryStores } from './inventory-store-io';

export interface HandKeys {
  weapon: string | null;
  shield: string | null;
}

export type HandsApprover = (hands: HandKeys) => boolean;

interface HandsGate {
  approve: HandsApprover;
  isBattleOpen: () => boolean;
}

let gate: HandsGate | null = null;

export function bindInventoryHandsGate(
  approve: HandsApprover | null,
  isBattleOpen: () => boolean = () => false,
): void {
  gate = approve ? { approve, isBattleOpen } : null;
}

export function battleOpen(): boolean {
  return gate?.isBattleOpen() ?? false;
}

export function locationOfSlotKey(slotKey: string): TItemLocation | null {
  if (slotKey.startsWith('eq:')) {
    const slot = slotKey.slice(3);
    return (EQUIP_SLOTS as readonly string[]).includes(slot)
      ? { container: 'equip', slot: slot as TEquipSlot }
      : null;
  }
  if (slotKey.startsWith('stash:')) {
    const index = Number(slotKey.slice(6));
    return Number.isInteger(index) && index >= 0 ? { container: 'stash', index } : null;
  }
  const index = bagIndexOfSlotKey(slotKey);
  return index === -1 ? null : { container: 'bag', index };
}

function handsOf(state: InventoryState): HandKeys {
  return { weapon: state.equip.weapon?.key ?? null, shield: state.equip.shield?.key ?? null };
}

function handsDiffer(a: InventoryState, b: InventoryState): boolean {
  const before = handsOf(a);
  const after = handsOf(b);
  return before.weapon !== after.weapon || before.shield !== after.shield;
}

export function moveBySlot(stores: InventoryStores, itemId: string, targetSlotKey: string): void {
  const item = stores.inventory.items.find((candidate) => candidate.id === itemId);
  if (!item || item.key === HEXOBJECT_KEYS.HAND) return;
  if (item.slotKey === targetSlotKey || targetSlotKey === BAG_WILL_SLOT_KEY) return;
  const from = locationOfSlotKey(item.slotKey);
  const to = locationOfSlotKey(targetSlotKey);
  if (!from || !to) return;

  const build = ({ heroId, revision }: { heroId: string; revision: number }) => ({
    type: 'MOVE_ITEM' as const,
    payload: { heroId, revision, from, to, split: false },
  });
  const context = { stashOpen: stores.stash.isOpen, battleOpen: false };

  const preview = dispatchInventory(stores, build, context, { commit: false });
  if (!preview.ok) return;
  if (gate && handsDiffer(preview.before, preview.after) && !gate.approve(handsOf(preview.after))) {
    return;
  }
  dispatchInventory(stores, build, context);
}
