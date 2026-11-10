import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readInventoryState } from './inventory-store-io';

const FALLBACK_HERO_ID = 'hero';

function stores() {
  return { inventory: useHeroInventoryStore(), stash: useHeroStashStore() };
}

export function inventoryStateFromStores(heroId: string): InventoryState {
  return readInventoryState(stores(), heroId || FALLBACK_HERO_ID);
}
