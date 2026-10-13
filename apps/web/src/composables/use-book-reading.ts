import { computed, watch, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

export function useBookReading(activeTool: ComputedRef<unknown>) {
  const worldStore = useWorldMapStore();
  const heroToolStore = useHeroToolStore();

  const isReading = computed(() => knowledgePanelMode.value === 'hall' && !!activeTool.value);

  const bookCoordinates = computed<IHexCoordinates | null>(
    () =>
      worldStore.map?.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.KNOWLEDGE_BOOK,
      )?.coordinates ?? null,
  );

  const anchor = computed<IHexCoordinates | null>(() =>
    isReading.value && bookCoordinates.value ? bookCoordinates.value : heroToolStore.hover,
  );

  watch(knowledgePanelMode, (now, previous) => {
    if (previous === 'hall' && !now) heroToolStore.stopTool();
  });

  return { isReading, anchor };
}
