import type HexMapModel from '../map/models/hex-map-model';
import type { ISerializedHexMap } from '../map/models/hex-map-model';
import { objectDestinationAction } from '../map/object-transition';
import { coordinateKey } from '../utils/hex-utils';

export type QuestEntranceAssociations = Record<string, string>;

export function restoreQuestEntrances(
  saved: ISerializedHexMap,
  map: HexMapModel,
  associations: QuestEntranceAssociations = {},
): QuestEntranceAssociations {
  const restored = { ...associations };
  for (const tile of saved.tiles) {
    const legacy = tile.hexobject as { questId?: unknown } | null;
    if (typeof legacy?.questId !== 'string') continue;
    const coordinates = tile.coordinates ?? { columnIndex: tile.q ?? 0, rowIndex: tile.r ?? 0 };
    const object = map.tiles.find(
      (entry) => coordinateKey(entry.coordinates) === coordinateKey(coordinates),
    )?.hexobject;
    if (object && objectDestinationAction(object, 'QUEST')) restored[legacy.questId] ??= object.id;
  }
  return restored;
}
