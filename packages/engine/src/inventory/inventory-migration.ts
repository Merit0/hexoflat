import { EQUIP_SLOTS, type TEquipSlot } from '../abstraction/hexobject-abstraction';
import type { InventoryItem } from '../abstraction/inventory-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { DEFAULT_CARRY_CAPACITY_KG, bagIndexOfSlotKey } from './bag-layout';
import {
  createInventoryState,
  emptyInventoryState,
  grantStarterGear,
  grantStarterScrolls,
  inventoryItemSchema,
  type InventoryState,
  type InventoryStateItem,
} from './inventory-state';
import { STASH_CAPACITY, STASH_CHEST_CELLS, STASH_MAX_CHESTS } from './stash-constants';

export interface LegacyBag {
  items: readonly InventoryItem[];
  carryCapacityKg?: number;
}

export interface LegacyStash {
  chests: number;
  starterGiven: boolean;
  cells: readonly (InventoryItem | null | undefined)[];
}

export interface MigratedInventory {
  state: InventoryState;
  overflow: InventoryStateItem[];
}

const EQUIP_PREFIX = 'eq:';

function slim(item: InventoryItem): InventoryStateItem | null {
  const parsed = inventoryItemSchema.safeParse({
    id: item.id,
    key: item.key,
    type: item.type,
    stackKey: item.stackKey,
    amount: item.amount,
  });
  return parsed.success ? (parsed.data as InventoryStateItem) : null;
}

function equipSlotOf(slotKey: string): TEquipSlot | null {
  if (!slotKey.startsWith(EQUIP_PREFIX)) return null;
  const slot = slotKey.slice(EQUIP_PREFIX.length);
  return (EQUIP_SLOTS as readonly string[]).includes(slot) ? (slot as TEquipSlot) : null;
}

function firstFree(cells: readonly (InventoryStateItem | null)[]): number {
  return cells.findIndex((cell) => cell === null);
}

function placeStray(state: InventoryState, item: InventoryStateItem): boolean {
  const bagIndex = firstFree(state.bag);
  if (bagIndex !== -1) {
    state.bag[bagIndex] = item;
    return true;
  }
  const owned = state.stash.cells.slice(0, state.stash.chests * STASH_CHEST_CELLS);
  const stashIndex = firstFree(owned);
  if (stashIndex === -1) return false;
  state.stash.cells[stashIndex] = item;
  return true;
}

function placeBagItems(
  state: InventoryState,
  legacy: LegacyBag,
  seen: Set<string>,
): InventoryStateItem[] {
  const strays: InventoryStateItem[] = [];
  for (const raw of legacy.items) {
    if (raw.key === HEXOBJECT_KEYS.HAND || seen.has(raw.id)) continue;
    const item = slim(raw);
    if (!item) continue;
    seen.add(item.id);
    const worn = equipSlotOf(raw.slotKey);
    if (worn && state.equip[worn] === null) {
      state.equip[worn] = item;
      continue;
    }
    const index = bagIndexOfSlotKey(raw.slotKey);
    if (index !== -1 && state.bag[index] === null) {
      state.bag[index] = item;
      continue;
    }
    strays.push(item);
  }
  return strays;
}

function placeStashItems(state: InventoryState, stash: LegacyStash, seen: Set<string>): void {
  for (let index = 0; index < STASH_CAPACITY; index += 1) {
    const raw = stash.cells[index];
    if (!raw || seen.has(raw.id)) continue;
    const item = slim(raw);
    if (!item) continue;
    seen.add(item.id);
    state.stash.cells[index] = item;
  }
}

export function migrateLegacyInventory(
  heroId: string,
  legacyBag: LegacyBag | null,
  legacyStash: LegacyStash | null,
): MigratedInventory {
  if (!legacyBag && !legacyStash) return { state: createInventoryState(heroId), overflow: [] };

  const state = emptyInventoryState(heroId);
  const seen = new Set<string>();
  state.capacityKg = legacyBag?.carryCapacityKg ?? DEFAULT_CARRY_CAPACITY_KG;
  if (legacyStash) {
    state.stash.chests = Math.min(STASH_MAX_CHESTS, Math.max(0, Math.trunc(legacyStash.chests)));
    state.stash.starterGiven = legacyStash.starterGiven;
    placeStashItems(state, legacyStash, seen);
  }
  const strays = legacyBag ? placeBagItems(state, legacyBag, seen) : [];
  const overflow = strays.filter((item) => !placeStray(state, item));

  if (!legacyBag) grantStarterScrolls(state);
  if (!state.stash.starterGiven) grantStarterGear(state, STASH_CHEST_CELLS);
  return { state, overflow };
}
