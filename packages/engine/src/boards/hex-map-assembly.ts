import HexMapModel, { type TFogPolicy } from '../map/models/hex-map-model';
import { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type { IHexMapPlacement } from '../abstraction/hex-map-placement';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { Complexity } from '../enums/complexity';
import type { ResolvedCell } from './resolved-cell';
import { DEFAULT_TERRAIN } from './terrain';

export interface AssembleHexMapInput {
  boardColumns: number;
  boardRows: number;
  background: string;
  fogPolicy?: TFogPolicy;
  cellAt: (coord: IHexCoordinates) => ResolvedCell;
}

export function assembleHexMapModel(input: AssembleHexMapInput): HexMapModel {
  const map = new HexMapModel();
  map.width = input.boardColumns;
  map.height = input.boardRows;
  map.complexity = Complexity.NORMAL;
  map.fogPolicy = input.fogPolicy ?? 'FOG';

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
      tile.terrain = cell.terrain ?? DEFAULT_TERRAIN;
      tile.exit = cell.exit;
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
