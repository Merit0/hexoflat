import { lootTableOf } from '../content/loot-tables.content';
import { getPrototype } from '../content/content-accessors';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { isTerrainPassable } from '../boards/terrain';
import { rollContainerContents } from '../containers/create-container';
import { lootNeighbours, type LootDrop } from '../loot';
import { type DropContext } from '../tokens/drop-context';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { axialToOffset, coordinateKey, type Axial } from '../utils/hex-utils';

export interface ChestLootContext {
  seed: string;
  sourceId: string;
  dropContext?: DropContext;
}

export function rollChestLoot(
  chest: HexTileModel,
  context: ChestLootContext | undefined,
): LootDrop[] {
  const proto = chest.hexobject ? getPrototype(chest.hexobject.hexobjectKey) : null;
  const tableId =
    proto?.groupType === EHexobjectGroup.CONSTRUCTION ? proto.construction.lootTableId : undefined;
  if (!context) return [];
  if (!context.dropContext) throw new Error('TOKEN_ORIGIN_REQUIRED: chest');
  const [drops] = rollContainerContents({
    kind: 'chest',
    tables: [lootTableOf(tableId)],
    seed: context.seed,
    sourceId: context.sourceId,
    targetKey: coordinateKey(chest.coordinates),
    dropContext: context.dropContext,
  });
  return drops ?? [];
}

export function chestNeighbours(map: HexMapModel, target: Axial) {
  const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  return lootNeighbours(target, (hex) => {
    const tile = byKey.get(coordinateKey(axialToOffset(hex)));
    return tile ? isTerrainPassable(tile.terrain) && !tile.hexobject : null;
  });
}
