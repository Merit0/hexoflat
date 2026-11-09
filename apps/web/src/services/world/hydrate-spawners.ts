import { applyCommand, type HexEngineActionContext } from '@hexoflat/engine';
import type HexMapModel from '@hexoflat/engine/map/models/hex-map-model';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { findTilesMissingSpawners } from '@hexoflat/engine/map/resource-hydration';

export function hydrateSpawners(
  map: HexMapModel,
  heroId: string,
  ctx: HexEngineActionContext,
  markTileDirty: (coordinates: IHexCoordinates) => void,
): void {
  for (const { tile, hexobject } of findTilesMissingSpawners(map)) {
    applyCommand(
      { map, heroes: {} },
      {
        type: 'ADD_RESOURCE_SPAWNER',
        payload: { heroId, coordinates: tile.coordinates, hexobject },
      },
      ctx,
    );
    markTileDirty(tile.coordinates);
  }
}
