import { computed, watch, type ComputedRef } from 'vue';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import { knowledgePanelMode } from '@/composables/use-knowledge-panel';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';

export function useBookReading(activeTool: ComputedRef<unknown>) {
  const worldStore = useWorldMapStore();
  const heroToolStore = useHeroToolStore();

  const isReading = computed(() => !!knowledgePanelMode.value && !!activeTool.value);

  const bookCoordinates = computed<IHexCoordinates | null>(() => {
    const key =
      knowledgePanelMode.value === 'quests'
        ? HEXOBJECT_KEYS.QUEST_BOARD
        : HEXOBJECT_KEYS.KNOWLEDGE_BOOK;
    return (
      worldStore.map?.tiles.find((tile) => tile.hexobject?.hexobjectKey === key)?.coordinates ??
      null
    );
  });

  const anchor = computed<IHexCoordinates | null>(() =>
    isReading.value && bookCoordinates.value ? bookCoordinates.value : heroToolStore.hover,
  );

  watch(knowledgePanelMode, (now, previous) => {
    if (previous && !now) heroToolStore.stopTool();
  });

  return { isReading, anchor };
}
