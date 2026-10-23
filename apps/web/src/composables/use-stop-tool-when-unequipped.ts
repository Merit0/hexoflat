import { watch } from 'vue';
import { useHeroInventoryStore } from '@/stores/hero-inventory-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

export function useStopToolWhenUnequipped(onStop: () => void) {
  const inventory = useHeroInventoryStore();
  const heroTool = useHeroToolStore();

  watch(
    () => Object.values(inventory.equippedItems).map((item) => item?.key),
    (equippedKeys) => {
      if (!heroTool.isDragging || !heroTool.activeTool) return;
      if (equippedKeys.includes(heroTool.activeTool)) return;
      onStop();
    },
  );
}
