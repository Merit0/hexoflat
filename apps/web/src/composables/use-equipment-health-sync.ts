import { watch } from 'vue';
import { sumEquippedHeartPoints } from '@hexoflat/engine/combat/heart-points';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroStore } from '@/stores/hero-store';

export function useEquipmentHealthSync() {
  const inventory = useHeroInventoryStore();
  const heroStore = useHeroStore();

  watch(
    () => sumEquippedHeartPoints(Object.values(inventory.equippedItems)),
    (bonus) => heroStore.setMaxHealthBonus(bonus),
  );
}
