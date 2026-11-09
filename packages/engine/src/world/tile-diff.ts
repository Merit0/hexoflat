import type HexMapModel from '../map/models/hex-map-model';
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

/** The tiles that differ from the snapshot, in the serialized form the client's map model reads. */
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
