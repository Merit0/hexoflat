import { computed } from 'vue';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { watchedHexes } from '@hexoflat/engine/squads/squad-state';
import { useWorldMapStore } from '@/stores/world-map-store';

export function useSquadViews() {
  const world = useWorldMapStore();

  const watched = computed<IHexCoordinates[]>(() => {
    void world.dirtyTick;
    const map = world.map as HexMapModel | null;
    return map ? watchedHexes(map) : [];
  });

  return { watched };
}
