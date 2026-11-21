import { getHexNeighbors, hexDistance } from '@hexoflat/engine/utils/hex-utils';
import { isEnterableTile } from '@hexoflat/engine/hero-movement/move-planner';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import { useWorldMapStore } from '@/stores/world-map-store';
import { useHeroStore } from '@/stores/hero-store';
import type { TestFogTile, TestHexCoordinates } from './test-api.types';

export const fogTestApi = {
  getPaidSteps: () => useHeroStore().paidSteps,
  findWorldStep(): TestHexCoordinates | null {
    const map = useWorldMapStore().map as HexMapModel | null;
    const hero = useHeroStore().heroCoordinates;
    if (!map || !hero) return null;
    return (
      getHexNeighbors(hero).find((at) => {
        const tile = map.tiles.find((entry) => hexDistance(at, entry.coordinates) === 0);
        return tile?.isRevealed && !tile.exit && !tile.hexobject && isEnterableTile(map, at);
      }) ?? null
    );
  },
  getFogTiles(center: TestHexCoordinates): TestFogTile[] {
    return (useWorldMapStore().map?.tiles ?? []).map((tile) => ({
      coordinates: { ...tile.coordinates },
      distance: hexDistance(center, tile.coordinates),
      revealed: tile.isRevealed,
    }));
  },
  findFogStep(): TestHexCoordinates | null {
    const map = useWorldMapStore().map as HexMapModel | null;
    const hero = useHeroStore().heroCoordinates;
    if (!map || !hero) return null;
    return (
      getHexNeighbors(hero).find((at) => {
        const tile = map.tiles.find((entry) => hexDistance(at, entry.coordinates) === 0);
        if (!tile || !tile.isRevealed || tile.exit || tile.hexobject || !isEnterableTile(map, at))
          return false;
        // Every scenario needs unexplored tiles in both outer rings, so it cannot pass on old fog.
        return [2, 3].every((distance) =>
          map.tiles.some(
            (entry) => !entry.isRevealed && hexDistance(at, entry.coordinates) === distance,
          ),
        );
      }) ?? null
    );
  },
};
