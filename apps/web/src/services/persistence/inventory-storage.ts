import { CONTENT_VERSION } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';

const INVENTORY_STORAGE_KEY = 'hexoflat.hero.inventory.v1';

export interface PersistedHeroInventory {
  version: 1;
  contentVersion: number;
  items: InventoryItem[];
  rotationsById: Record<string, number>;
  carryCapacityKg: number;
}

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

export function readSavedInventory(): Pick<
  PersistedHeroInventory,
  'items' | 'rotationsById' | 'carryCapacityKg'
> | null {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedHeroInventory>;
    if (parsed?.version !== 1 || parsed?.contentVersion !== CONTENT_VERSION) return null;

    return {
      items: Array.isArray(parsed.items) ? parsed.items.filter(isSerializableInventoryItem) : [],
      rotationsById:
        parsed.rotationsById && typeof parsed.rotationsById === 'object'
          ? parsed.rotationsById
          : {},
      carryCapacityKg: typeof parsed.carryCapacityKg === 'number' ? parsed.carryCapacityKg : 5,
    };
  } catch (error) {
    console.error('Failed to hydrate hero inventory:', error);
    return null;
  }
}

export function writeSavedInventory(
  state: Pick<PersistedHeroInventory, 'items' | 'rotationsById' | 'carryCapacityKg'>,
): void {
  try {
    const payload: PersistedHeroInventory = {
      version: 1,
      contentVersion: CONTENT_VERSION,
      ...state,
    };

    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.error('Failed to persist hero inventory:', error);
  }
}

export function clearSavedInventory(): void {
  localStorage.removeItem(INVENTORY_STORAGE_KEY);
}
