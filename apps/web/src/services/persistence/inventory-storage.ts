import { CONTENT_VERSION } from '@hexoflat/engine';
import { DEFAULT_CARRY_CAPACITY_KG } from '@hexoflat/engine/inventory/bag-layout';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';

const INVENTORY_STORAGE_KEY = 'hexoflat.hero.inventory.v1';

export interface PersistedHeroInventory {
  version: 1;
  contentVersion: number;
  items: InventoryItem[];
  rotationsById: Record<string, number>;
  carryCapacityKg: number;
}

export type SavedBag = Pick<PersistedHeroInventory, 'items' | 'rotationsById' | 'carryCapacityKg'>;

function isSerializableInventoryItem(value: unknown): value is InventoryItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;

  return (
    typeof v.id === 'string' &&
    typeof v.key === 'string' &&
    typeof v.type === 'string' &&
    typeof v.amount === 'number' &&
    typeof v.slotKey === 'string' &&
    typeof v.isNew === 'boolean'
  );
}

export function bagPayload(state: SavedBag): PersistedHeroInventory {
  return { version: 1, contentVersion: CONTENT_VERSION, ...state };
}

export function parseSavedBag(value: unknown): SavedBag | null {
  const parsed = value as Partial<PersistedHeroInventory> | null;
  if (parsed?.version !== 1 || parsed?.contentVersion !== CONTENT_VERSION) return null;
  return {
    items: Array.isArray(parsed.items) ? parsed.items.filter(isSerializableInventoryItem) : [],
    rotationsById:
      parsed.rotationsById && typeof parsed.rotationsById === 'object' ? parsed.rotationsById : {},
    carryCapacityKg:
      typeof parsed.carryCapacityKg === 'number'
        ? parsed.carryCapacityKg
        : DEFAULT_CARRY_CAPACITY_KG,
  };
}

export function readSavedInventory(): SavedBag | null {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    return raw ? parseSavedBag(JSON.parse(raw)) : null;
  } catch (error) {
    console.error('Failed to hydrate hero inventory:', error);
    return null;
  }
}

export function writeSavedInventory(state: SavedBag): void {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(bagPayload(state)));
  } catch (error) {
    console.error('Failed to persist hero inventory:', error);
  }
}

export function clearSavedInventory(): void {
  localStorage.removeItem(INVENTORY_STORAGE_KEY);
}
