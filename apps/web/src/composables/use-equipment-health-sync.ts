import { watch } from 'vue';
import { sumHeartPoints } from '@hexoflat/engine/combat/heart-points';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';

export function useEquipmentHealthSync() {
  const inventory = useHeroInventoryStore();
  const heroStore = useHeroStore();

  watch(
    () => sumHeartPoints(Object.values(inventory.equippedItems).map((item) => item?.key)),
    (bonus) => heroStore.setMaxHealthBonus(bonus),
  );
}
