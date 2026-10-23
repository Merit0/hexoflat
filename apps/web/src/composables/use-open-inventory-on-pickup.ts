import { watch } from 'vue';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';

export function useOpenInventoryOnPickup(onPickup: () => void) {
  const inventory = useHeroInventoryStore();

  watch(
    () =>
      inventory.items.reduce(
        (total, item) => (item.key === HEXOBJECT_KEYS.HAND ? total : total + item.amount),
        0,
      ),
    (next, previous) => {
      if (inventory.isHydrated && next > previous) onPickup();
    },
    { flush: 'sync' },
  );
}
