import {
  planItemAutoPlace,
  planItemMove,
  planSortStash,
  planStoreResources,
  coinHandSlot,
  planUnlockStashChest,
  type IInventoryAggregate,
  type TUnlockChestResult,
  type ITransferOptions,
  type TTransferResult,
} from '@hexoflat/engine/inventory/item-transfer';
import type { TItemLocation } from '@hexoflat/engine/inventory/item-location';
import { stashChestPrice } from '@hexoflat/engine/inventory/stash-constants';
import { useHeroInventoryStore, WILL_SLOT_KEY } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { bagSlotKeys, fromAggregate, toAggregate } from './inventory-aggregate';

function slotKeys(): string[] {
  return bagSlotKeys(useHeroInventoryStore().grid, WILL_SLOT_KEY);
}

export function readInventoryAggregate(): IInventoryAggregate {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  inventory.hydrate();
  stash.hydrate();
  return toAggregate(inventory.items, stash.ownedCells, slotKeys());
}

function transferOptions(split: boolean): ITransferOptions {
  return {
    split,
    capacityKg: useHeroInventoryStore().carryCapacityKg,
    stashOpen: useHeroStashStore().isOpen,
    newId: () => crypto.randomUUID(),
    stashPreferred: useHeroStashStore().preferredRange,
  };
}

function applyAggregate(next: IInventoryAggregate): void {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();
  const applied = fromAggregate(next, inventory.items, slotKeys());
  inventory.items = applied.items;
  for (const item of [...applied.items, ...applied.stash]) {
    if (item) inventory.ensureRotation(item.id);
  }
  inventory.fillEmptySlotsWithHands();
  inventory.persist();
  stash.replaceOwnedCells(applied.stash);
}

function run(plan: (agg: IInventoryAggregate) => TTransferResult): TTransferResult {
  const result = plan(readInventoryAggregate());
  if (result.ok && result.kind !== 'noop') applyAggregate(result.next);
  return result;
}

export function previewMove(from: TItemLocation, to: TItemLocation, split = false) {
  return planItemMove(readInventoryAggregate(), from, to, transferOptions(split));
}

export function previewAutoPlace(from: TItemLocation, toContainer: 'bag' | 'stash', split = false) {
  return planItemAutoPlace(readInventoryAggregate(), from, toContainer, transferOptions(split));
}

export function moveItem(from: TItemLocation, to: TItemLocation, split = false) {
  return run((agg) => planItemMove(agg, from, to, transferOptions(split)));
}

export function autoPlaceItem(from: TItemLocation, toContainer: 'bag' | 'stash', split = false) {
  return run((agg) => planItemAutoPlace(agg, from, toContainer, transferOptions(split)));
}

export function unlockNextChest(): TUnlockChestResult {
  const stash = useHeroStashStore();
  const agg = readInventoryAggregate();
  const slot = coinHandSlot(agg);
  if (!slot) {
    return { ok: false, reason: 'NO_COINS_IN_HAND', price: stashChestPrice(stash.chests) };
  }
  const result = planUnlockStashChest(agg, stash.chests, slot);
  if (!result.ok) return result;
  applyAggregate(result.next);
  stash.setChests(result.chests);
  stash.selectChest(result.chests - 1);
  return result;
}

export function storeResources() {
  const stash = useHeroStashStore();
  return run((agg) =>
    planStoreResources(agg, { stashOpen: stash.isOpen, stashPreferred: stash.preferredRange }),
  );
}

export function sortStash() {
  return run((agg) => planSortStash(agg, { stashOpen: useHeroStashStore().isOpen }));
}
