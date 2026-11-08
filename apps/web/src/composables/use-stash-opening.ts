import { computed, watch, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { useHeroStashStore } from '@/stores/hero-stash-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';

/** While the stash is open the hand tool stays on the chest and works, like on the Book of Will. */
export function useStashOpening(activeTool: ComputedRef<unknown>) {
  const worldStore = useWorldMapStore();
  const heroToolStore = useHeroToolStore();
  const stash = useHeroStashStore();

  const isOpening = computed(() => stash.isOpen && !!activeTool.value);

  const chestCoordinates = computed<IHexCoordinates | null>(
    () =>
      worldStore.map?.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.STASH_CHEST,
      )?.coordinates ?? null,
  );

  const anchor = computed<IHexCoordinates | null>(() =>
    isOpening.value ? chestCoordinates.value : null,
  );

  watch(
    () => stash.isOpen,
    (now, previous) => {
      if (previous && !now) heroToolStore.stopTool();
    },
  );

  return { isOpening, anchor };
}
