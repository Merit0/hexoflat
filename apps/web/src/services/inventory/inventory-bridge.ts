import type { HexEngineState } from '@hexoflat/engine';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { readInventoryState, writeInventoryState } from './inventory-store-io';

const FALLBACK_HERO_ID = 'hero';

function stores() {
  return { inventory: useHeroInventoryStore(), stash: useHeroStashStore() };
}

export function inventoryStateFromStores(heroId: string): InventoryState {
  return readInventoryState(stores(), heroId || FALLBACK_HERO_ID);
}

export function withStoreInventory<T>(
  heroId: string,
  state: HexEngineState,
  run: (state: HexEngineState) => T,
): T {
  const loaded = inventoryStateFromStores(heroId);
  state.inventory = loaded;
  const result = run(state);
  if (state.inventory && state.inventory !== loaded) {
    writeInventoryState(stores(), state.inventory);
  }
  return result;
}
