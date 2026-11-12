import { campObjectSpots } from '../content/boards/camp-object-spot';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';

export const CAMP_FACILITY_KEYS: readonly THexobjectKey[] = [
  HEXOBJECT_KEYS.TRADER_STALL,
  HEXOBJECT_KEYS.TRAINING_GROUNDS,
];

export function installCampFacilities(
  map: HexMapModel,
  hero: IHexCoordinates | null,
): IHexCoordinates[] {
  const heroKey = hero ? coordinateKey(hero) : null;
  const installed: IHexCoordinates[] = [];
  for (const key of CAMP_FACILITY_KEYS) {
    if (map.tiles.some((tile) => tile.hexobject?.hexobjectKey === key)) continue;
    for (const spot of campObjectSpots(key)) {
      const spotKey = coordinateKey(spot);
      if (spotKey === heroKey) continue;
      const tile = map.tiles.find((candidate) => coordinateKey(candidate.coordinates) === spotKey);
      if (!tile || tile.hexobject) continue;
      tile.hexobject = HexObjectFactory.create(key, spot);
      installed.push({ ...spot });
    }
  }
  return installed;
}
