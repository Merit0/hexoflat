import { HexObjectFactory } from '../factory/hex-object-factory';
import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import { coordinateKey } from '../utils/hex-utils';
import type { ChestLootPlan } from './plan-chest-loot';

export interface ChestLootSite {
  map: HexMapModel;
  chest: IHexCoordinates;
  entry: IHexCoordinates;
  plan: ChestLootPlan;
  inventory: IInventoryDraft;
}

export function placeChestLoot(
  site: ChestLootSite,
): ChestLootPlan & { placed: ChestLootPlan['placements'] } {
  const byKey = new Map(site.map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  for (const placement of site.plan.placements) {
    const tile = byKey.get(coordinateKey(placement.coordinates));
    if (!tile) continue;
    tile.hexobject = HexObjectFactory.create(placement.itemKey, placement.coordinates, {
      quantity: placement.amount,
    });
  }
  for (const drop of site.plan.toBag) {
    grantToDraft(site.inventory, drop.itemKey, drop.amount, 'loot');
  }
  return { ...site.plan, placed: site.plan.placements };
}
