import { lootTableOf } from '../content/loot-tables.content';
import { getPrototype } from '../content/content-accessors';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { isTerrainPassable } from '../boards/terrain';
import type { IInventoryDraft } from '../inventory/apply-stock';
import {
  lootNeighbours,
  offsetPlacement,
  planLootSpread,
  rollLootList,
  type LootDrop,
} from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { axialToOffset, coordinateKey, offsetToAxial, type Axial } from '../utils/hex-utils';

export interface ChestLootContext {
  seed: string;
  sourceId: string;
}

export interface ChestPlacement {
  coordinates: IHexCoordinates;
  itemKey: LootDrop['itemKey'];
  amount: number;
}

export interface ChestLootPlan {
  placements: ChestPlacement[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
}

export type ChestLootResult =
  { ok: true; plan: ChestLootPlan } | { ok: false; reason: 'NO_ROOM_FOR_LOOT' | 'BAG_FULL' };

export const EMPTY_CHEST_LOOT: ChestLootPlan = { placements: [], toBag: [] };

export function rollChestLoot(
  chest: HexTileModel,
  context: ChestLootContext | undefined,
): LootDrop[] {
  const proto = chest.hexobject ? getPrototype(chest.hexobject.hexobjectKey) : null;
  const tableId =
    proto?.groupType === EHexobjectGroup.CONSTRUCTION ? proto.construction.lootTableId : undefined;
  if (!context) return [];
  return rollLootList(lootTableOf(tableId), {
    seed: context.seed,
    sourceId: context.sourceId,
    targetKey: coordinateKey(chest.coordinates),
  });
}

export function chestNeighbours(map: HexMapModel, target: Axial) {
  const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  return lootNeighbours(target, (hex) => {
    const tile = byKey.get(coordinateKey(axialToOffset(hex)));
    return tile ? isTerrainPassable(tile.terrain) && !tile.hexobject : null;
  });
}

export function planChestLoot(
  map: HexMapModel,
  chest: HexTileModel,
  entry: IHexCoordinates,
  context: ChestLootContext | undefined,
  draft: IInventoryDraft,
): ChestLootResult {
  const drops = rollChestLoot(chest, context);
  if (drops.length === 0) return { ok: true, plan: EMPTY_CHEST_LOOT };
  const target = offsetToAxial(chest.coordinates);
  const spread = planLootSpread({
    target,
    entry: offsetToAxial(entry),
    neighbours: chestNeighbours(map, target),
    lists: [drops],
    bag: draft,
  });
  if (!spread.ok) return spread;
  return {
    ok: true,
    plan: {
      placements: spread.plan.placements.map((placement) =>
        offsetPlacement(placement, 'coordinates'),
      ),
      toBag: spread.plan.toBag,
    },
  };
}
