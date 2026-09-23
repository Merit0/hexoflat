import HexMapModel from '../map/models/hex-map-model';
import { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { IHexMapPlacement } from '../abstraction/hex-map-placement';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { Complexity } from '../enums/complexity';
import type { ResolvedCell } from './resolved-cell';

export interface AssembleHexMapInput {
  boardColumns: number;
  boardRows: number;
  background: string;
  cellAt: (coord: IHexCoordinates) => ResolvedCell;
}

/** Shared final step (docs/WORLD-MAP-BOARDS-PLAN.md §3.5) for both buildStaticBoard and assembleGeneratedBoard: tiles only for existing cells, objects via HexObjectFactory, map.config grouped by (hexobjectKey + overrides) for resource-hydration.ts. */
export function assembleHexMapModel(input: AssembleHexMapInput): HexMapModel {
  const map = new HexMapModel();
  map.width = input.boardColumns;
  map.height = input.boardRows;
  map.complexity = Complexity.NORMAL;
  map.fogPolicy = 'FOG';

  const tiles: HexTileModel[] = [];
  const placementGroups = new Map<string, IHexMapPlacement>();

  for (let rowIndex = 0; rowIndex < input.boardRows; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < input.boardColumns; columnIndex += 1) {
      const coordinates: IHexCoordinates = { columnIndex, rowIndex };
      const cell = input.cellAt(coordinates);
      if (!cell.exists) continue;

      const tile = new HexTileModel();
      tile.tileId = `${columnIndex}:${rowIndex}`;
      tile.coordinates = coordinates;
      tile.isRevealed = false;
      tile.hexBackgroundImagePath = input.background;

      if (cell.hexobject) {
        tile.hexobject = HexObjectFactory.create(
          cell.hexobject.hexobjectKey,
          coordinates,
          cell.hexobject.overrides,
        );

        const groupKey = `${cell.hexobject.hexobjectKey}:${JSON.stringify(cell.hexobject.overrides ?? null)}`;
        const group = placementGroups.get(groupKey);
        if (group) {
          group.coordinates.push(coordinates);
        } else {
          placementGroups.set(groupKey, {
            hexobject: {
              hexobjectKey: cell.hexobject.hexobjectKey,
              overrides: cell.hexobject.overrides,
            },
            coordinates: [coordinates],
          });
        }
      }

      tiles.push(tile);
    }
  }

  map.tiles = tiles;
  map.config = [...placementGroups.values()];

  return map;
}
