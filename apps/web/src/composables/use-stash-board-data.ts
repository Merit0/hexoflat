import { computed } from 'vue';
import { compareItemsForSort } from '@hexoflat/engine/inventory/item-transfer';
import { STASH_CHEST_CELLS } from '@hexoflat/engine/inventory/stash-constants';
import { BAG_SLOT_KEYS } from '@hexoflat/engine/inventory/bag-layout';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { toAggregate } from '@/services/inventory/inventory-aggregate';

export function formatKg(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function useStashBoardData() {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();

  const aggregate = computed(() =>
    toAggregate(inventory.items, stash.ownedCells, [...BAG_SLOT_KEYS]),
  );

  const bagView = computed(() => {
    const cells = aggregate.value.bag;
    const filled = cells.flatMap((item, index) => (item ? [{ item, index }] : []));
    filled.sort((a, b) => compareItemsForSort(a.item, b.item) || a.index - b.index);
    const free = cells.flatMap((item, index) => (item ? [] : [{ item, index }]));
    return [...filled, ...free];
  });

  const loadRatio = computed(() =>
    inventory.carryCapacityKg > 0
      ? Math.min(1, inventory.carriedWeightKg / inventory.carryCapacityKg)
      : 0,
  );

  const activeCells = computed(() => {
    const start = stash.activeChest * STASH_CHEST_CELLS;
    return stash.cells.slice(start, start + STASH_CHEST_CELLS).map((item, offset) => ({
      item,
      index: start + offset,
    }));
  });

  return {
    bagView,
    activeCells,
    carried: computed(() => formatKg(inventory.carriedWeightKg)),
    capacity: computed(() => formatKg(inventory.carryCapacityKg)),
    loadRatio,
    isHeavy: computed(() => loadRatio.value > 0.85),
    isOver: computed(() => inventory.isOverCapacity),
    stashUsed: computed(() => stash.usedCount),
    stashCapacity: computed(() => stash.capacity),
  };
}
