import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { createContainer } from '../containers';
import { getPrototype } from '../content/content-accessors';
import { lootTableOf } from '../content/loot-tables.content';
import type HexMapModel from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, offsetToAxial } from '../utils/hex-utils';

export function createChestContainers(
  map: HexMapModel,
  source: { seed: string; sourceId: string },
): void {
  for (const tile of map.tiles) {
    const object = tile.hexobject;
    if (object?.hexobjectKey !== HEXOBJECT_KEYS.CHEST || object.container) continue;
    const proto = getPrototype(object.hexobjectKey);
    const tableId =
      proto.groupType === EHexobjectGroup.CONSTRUCTION ? proto.construction.lootTableId : undefined;
    const key = coordinateKey(tile.coordinates);
    object.container = createContainer({
      id: key,
      kind: 'chest',
      at: offsetToAxial(tile.coordinates),
      tables: [lootTableOf(tableId)],
      seed: source.seed,
      sourceId: source.sourceId,
      targetKey: key,
    });
  }
}
