import { useGatheringStore } from '@/stores/gathering-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { useWorldMapStore } from '@/stores/world-map-store';

export const harvestTestApi = {
  getHarvest() {
    const tool = useHeroToolStore();
    return {
      wood: tool.treesCut,
      stone: tool.stoneCollected,
      counts: { ...useGatheringStore().counts },
      pending: (useWorldMapStore().map?.tiles ?? []).flatMap((tile) =>
        tile.pendingAction
          ? [
              {
                ...tile.coordinates,
                type: tile.pendingAction.type,
                bonus: tile.pendingAction.harvestBonus ?? 0,
              },
            ]
          : [],
      ),
    };
  },
};
