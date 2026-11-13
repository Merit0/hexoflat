import { lootTableOf } from '../content/loot-tables.content';
import { getPrototype } from '../content/content-accessors';
import { EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { isTerrainPassable } from '../boards/terrain';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import { lootStreamLabel, placeLoot, rollLoot, type LootDrop } from '../loot';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import {
  AXIAL_DIRS,
  axialToOffset,
  coordinateKey,
  offsetToAxial,
  type Axial,
} from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';

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
  const table = lootTableOf(tableId);
  if (!table || !context) return [];
  const rng = deriveStream(
    context.seed,
    lootStreamLabel(context.sourceId, coordinateKey(chest.coordinates)),
  );
  return rollLoot(table, rng);
}

function neighboursOf(map: HexMapModel, target: Axial) {
  const byKey = new Map(map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  return AXIAL_DIRS.flatMap((dir) => {
    const hex = { q: target.q + dir.q, r: target.r + dir.r };
    const tile = byKey.get(coordinateKey(axialToOffset(hex)));
    if (!tile) return [];
    return [{ hex, free: isTerrainPassable(tile.terrain) && !tile.hexobject }];
  });
}

function bagTakesAll(draft: IInventoryDraft, drops: readonly LootDrop[]): boolean {
  const trial: IInventoryDraft = { current: draft.current, events: [] };
  return drops.every((drop) => grantToDraft(trial, drop.itemKey, drop.amount, 'loot'));
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
  const result = placeLoot({
    target,
    entry: offsetToAxial(entry),
    neighbours: neighboursOf(map, target),
    drops: [drops],
  });
  if (result.kind === 'refused') return { ok: false, reason: result.refusal.reason };
  if (result.kind === 'to-bag') {
    if (!bagTakesAll(draft, result.drops)) return { ok: false, reason: 'BAG_FULL' };
    return {
      ok: true,
      plan: {
        placements: [],
        toBag: result.drops.map(({ itemKey, amount }) => ({ itemKey, amount })),
      },
    };
  }
  return {
    ok: true,
    plan: {
      placements: result.placements.map(({ hex, itemKey, amount }) => ({
        coordinates: axialToOffset(hex),
        itemKey,
        amount,
      })),
      toBag: [],
    },
  };
}
