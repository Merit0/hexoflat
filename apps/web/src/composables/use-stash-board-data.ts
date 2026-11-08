import { computed } from 'vue';
import { useHeroInventoryStore, WILL_SLOT_KEY } from '@/stores/hero-inventory-store';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { bagSlotKeys, toAggregate } from '@/services/inventory/inventory-aggregate';

function formatKg(value: number): string {
  return String(Number(value.toFixed(1)));
}

export function useStashBoardData() {
  const inventory = useHeroInventoryStore();
  const stash = useHeroStashStore();

  const aggregate = computed(() =>
    toAggregate(inventory.items, stash.cells, bagSlotKeys(inventory.grid, WILL_SLOT_KEY)),
  );

  const loadRatio = computed(() =>
    inventory.carryCapacityKg > 0
      ? Math.min(1, inventory.carriedWeightKg / inventory.carryCapacityKg)
      : 0,
  );

  return {
    bag: computed(() => aggregate.value.bag),
    equip: computed(() => aggregate.value.equip),
    stash: computed(() => aggregate.value.stash),
    carried: computed(() => formatKg(inventory.carriedWeightKg)),
    capacity: computed(() => formatKg(inventory.carryCapacityKg)),
    loadRatio,
    isHeavy: computed(() => loadRatio.value > 0.85),
    isOver: computed(() => inventory.isOverCapacity),
    stashUsed: computed(() => stash.usedCount),
    stashCapacity: computed(() => stash.capacity),
  };
}
