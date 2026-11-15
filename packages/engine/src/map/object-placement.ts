import type { THexobject } from '../abstraction/hexobject-abstraction';
import { isTerrainPassable } from '../boards/terrain';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { pickRandom, type RandomNumberGenerator } from '../utils/random';
import type { IHexCoordinates } from './interfaces/hex-tile-config-interface';
import type HexMapModel from './models/hex-map-model';
import type { HexTileModel } from './models/hex-tile-model';

export type ObjectPlacement =
  | { strategy: 'random-empty'; random: RandomNumberGenerator }
  | { strategy: 'empty'; coordinates: IHexCoordinates }
  | { strategy: 'replace'; coordinates: IHexCoordinates; expectedObjectKey: THexobjectKey };

export interface PlacementRestrictions {
  occupied?: readonly IHexCoordinates[];
  eligible?: (tile: HexTileModel) => boolean;
}

export type PlacementResult =
  | { ok: true; coordinates: IHexCoordinates }
  | { ok: false; reason: 'NO_ELIGIBLE_HEX' | 'REPLACEMENT_MISMATCH' };

function available(tile: HexTileModel, restrictions: PlacementRestrictions): boolean {
  return (
    isTerrainPassable(tile.terrain) &&
    !tile.resourceSpawner &&
    !tile.pendingAction &&
    !tile.exit &&
    !restrictions.occupied?.some((at) => coordinateKey(at) === coordinateKey(tile.coordinates)) &&
    (restrictions.eligible?.(tile) ?? true)
  );
}

/** Pure selection: fog and tile order never influence eligibility or seeded choice. */
export function planObjectPlacement(
  map: HexMapModel,
  placement: ObjectPlacement,
  restrictions: PlacementRestrictions = {},
): PlacementResult {
  if (placement.strategy !== 'random-empty') {
    const tile = map.tiles.find(
      (candidate) => coordinateKey(candidate.coordinates) === coordinateKey(placement.coordinates),
    );
    if (!tile || !available(tile, restrictions)) return { ok: false, reason: 'NO_ELIGIBLE_HEX' };
    if (placement.strategy === 'replace') {
      if (tile.hexobject?.hexobjectKey !== placement.expectedObjectKey)
        return { ok: false, reason: 'REPLACEMENT_MISMATCH' };
    } else if (tile.hexobject) return { ok: false, reason: 'NO_ELIGIBLE_HEX' };
    return { ok: true, coordinates: { ...tile.coordinates } };
  }
  const candidates = map.tiles
    .filter((tile) => !tile.hexobject && available(tile, restrictions))
    .sort((a, b) => coordinateKey(a.coordinates).localeCompare(coordinateKey(b.coordinates)));
  const chosen = pickRandom(candidates, placement.random);
  return chosen
    ? { ok: true, coordinates: { ...chosen.coordinates } }
    : { ok: false, reason: 'NO_ELIGIBLE_HEX' };
}

/** Apply a validated placement inside a command/reconciliation transaction. */
export function placeMapObject(
  map: HexMapModel,
  objectKey: THexobjectKey,
  placement: ObjectPlacement,
  restrictions: PlacementRestrictions = {},
):
  | (PlacementResult & { ok: false })
  | { ok: true; coordinates: IHexCoordinates; object: THexobject } {
  const result = planObjectPlacement(map, placement, restrictions);
  if (!result.ok) return result;
  const tile = map.tiles.find(
    (candidate) => coordinateKey(candidate.coordinates) === coordinateKey(result.coordinates),
  )!;
  const object = HexObjectFactory.create(objectKey, result.coordinates);
  tile.hexobject = object;
  return { ...result, object };
}
