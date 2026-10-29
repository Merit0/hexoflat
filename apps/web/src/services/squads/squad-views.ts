import { computed } from 'vue';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { projectSquads, watchedHexes, type SquadView } from '@hexoflat/engine/squads/squad-state';
import { coordinateKey } from '@hexoflat/engine/utils/hex-utils';
import { heroThreatProfile } from './squad-loadout';
import { squadLoadoutSource } from './squad-flow';
import { useWorldMapStore } from '@/stores/world-map-store';

export function useSquadViews() {
  const world = useWorldMapStore();

  function currentMap(): HexMapModel | null {
    void world.dirtyTick;
    return world.map as HexMapModel | null;
  }

  const views = computed<SquadView[]>(() => {
    const map = currentMap();
    return map ? projectSquads(map, heroThreatProfile(squadLoadoutSource())) : [];
  });

  const watched = computed<IHexCoordinates[]>(() => {
    const map = currentMap();
    return map ? watchedHexes(map) : [];
  });

  function viewAt(at: IHexCoordinates): SquadView | null {
    const key = coordinateKey(at);
    return views.value.find((view) => coordinateKey(view.coordinates) === key) ?? null;
  }

  return { views, watched, viewAt };
}
