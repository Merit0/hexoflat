import HexMapModel from '../map/models/hex-map-model';
import { coordinateKey } from '../utils/hex-utils';

export type TileSnapshot = Map<string, string>;

type SerializedTile = ReturnType<HexMapModel['toJSON']>['tiles'][number];

export function snapshotTiles(map: HexMapModel): TileSnapshot {
  const snapshot: TileSnapshot = new Map();
  for (const tile of map.toJSON().tiles) {
    snapshot.set(coordinateKey(tile.coordinates), JSON.stringify(tile));
  }
  return snapshot;
}

export interface TileDiff {
  coordinates: { columnIndex: number; rowIndex: number };
  tile: SerializedTile;
}

export function diffTiles(before: TileSnapshot, map: HexMapModel): TileDiff[] {
  const diffs: TileDiff[] = [];
  for (const tile of map.toJSON().tiles) {
    const raw = JSON.stringify(tile);
    if (before.get(coordinateKey(tile.coordinates)) !== raw) {
      diffs.push({ coordinates: { ...tile.coordinates }, tile });
    }
  }
  return diffs;
}

export function applyTileDiffs(
  map: HexMapModel,
  diffs: readonly TileDiff[],
  now: number,
): { columnIndex: number; rowIndex: number }[] {
  const changed: { columnIndex: number; rowIndex: number }[] = [];
  for (const diff of diffs) {
    const target = map.tiles.find(
      (tile) =>
        tile.coordinates.columnIndex === diff.coordinates.columnIndex &&
        tile.coordinates.rowIndex === diff.coordinates.rowIndex,
    );
    if (!target) continue;
    const [restored] = HexMapModel.fromJSON(
      {
        name: map.name,
        width: map.width,
        height: map.height,
        complexity: map.complexity,
        config: map.config,
        fogPolicy: map.fogPolicy,
        tiles: [diff.tile],
      },
      now,
      { keepUseActions: true },
    ).tiles;
    target.isRevealed = restored.isRevealed;
    target.hexBackgroundImagePath = restored.hexBackgroundImagePath;
    target.hexobject = restored.hexobject;
    target.resourceSpawner = restored.resourceSpawner;
    target.pendingAction = restored.pendingAction;
    target.terrain = restored.terrain;
    target.exit = restored.exit;
    target.regionId = restored.regionId;
    changed.push({ ...diff.coordinates });
  }
  return changed;
}
