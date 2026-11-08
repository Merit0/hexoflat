import { getMeta, getPrototype } from '@hexoflat/engine';
import type { InventoryItem } from '@hexoflat/engine/abstraction/inventory-abstraction';
import type { THexobjectKey } from '@hexoflat/engine/registry/hexobjects-registry';
import { STASH_CAPACITY } from '@hexoflat/engine/inventory/stash-constants';
import { useHeroInventoryStore, WILL_SLOT_KEY } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { bagSlotKeys, toAggregate } from '@/services/inventory/inventory-aggregate';

interface FixtureCell {
  key: string;
  amount: number;
}

interface ReadCell extends FixtureCell {
  id: string;
}

function summarise(cells: (InventoryItem | null)[]): (ReadCell | null)[] {
  return cells.map((item) => (item ? { id: item.id, key: item.key, amount: item.amount } : null));
}

function fixtureItem(cell: FixtureCell, slotKey: string): InventoryItem {
  const key = cell.key as THexobjectKey;
  const stackable = !!getMeta(key)?.traits?.stackable;
  return {
    id: crypto.randomUUID(),
    key,
    type: getPrototype(key).groupType,
    stackKey: stackable ? key : undefined,
    amount: cell.amount,
    slotKey,
    isNew: false,
  };
}

function slotKeys(): string[] {
  return bagSlotKeys(useHeroInventoryStore().grid, WILL_SLOT_KEY);
}

export const stashTestFixtures = {
  readStash(): (ReadCell | null)[] {
    const stash = useHeroStashStore();
    stash.hydrate();
    return summarise(stash.ownedCells);
  },

  readBag(): (ReadCell | null)[] {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    return summarise(toAggregate(inventory.items, [], slotKeys()).bag);
  },

  writeStash(cells: (FixtureCell | null)[]): void {
    const stash = useHeroStashStore();
    stash.hydrate();
    const next = Array.from({ length: STASH_CAPACITY }, (_, index) => {
      const cell = cells[index];
      return cell ? fixtureItem(cell, `stash:${index}`) : null;
    });
    stash.replaceOwnedCells(next);
  },

  readChests(): number {
    const stash = useHeroStashStore();
    stash.hydrate();
    return stash.chests;
  },

  writeChests(chests: number): void {
    const stash = useHeroStashStore();
    stash.hydrate();
    stash.setChests(chests);
  },

  writeBag(cells: (FixtureCell | null)[]): void {
    const inventory = useHeroInventoryStore();
    inventory.hydrate();
    const keys = slotKeys();
    const bagKeys = new Set(keys);
    const kept = inventory.items.filter((item) => !bagKeys.has(item.slotKey));
    const placed = cells.flatMap((cell, index) =>
      cell && keys[index] ? [fixtureItem(cell, keys[index])] : [],
    );
    inventory.items = [...kept, ...placed];
    for (const item of placed) inventory.ensureRotation(item.id);
    inventory.persist();
  },
};

const HOOKS_ON = import.meta.env.VITE_E2E_HOOKS === 'true';

export const stashTestApi = {
  getStash: () => stashTestFixtures.readStash(),
  getBag: () => stashTestFixtures.readBag(),
  getStashChests: () => stashTestFixtures.readChests(),
  setStashChests(chests: number) {
    if (HOOKS_ON) stashTestFixtures.writeChests(chests);
  },
  setStash(cells: (FixtureCell | null)[]) {
    if (HOOKS_ON) stashTestFixtures.writeStash(cells);
  },
  setBag(cells: (FixtureCell | null)[]) {
    if (HOOKS_ON) stashTestFixtures.writeBag(cells);
  },
};
