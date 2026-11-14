import type { DomainEvent } from '../commands/types';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import type { HeroState } from '../hero-movement/hero-state';
import { revealAroundHero } from '../map/fog-service';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { hexDistance } from '../utils/hex-utils';
import type { IInventoryDraft } from '../inventory/apply-stock';
import { placeChestLoot } from './place-chest-loot';
import { planChestLoot, type ChestLootContext, type ChestLootPlan } from './plan-chest-loot';

export type ChestRefusal =
  | 'NO_HERO'
  | 'STANDING_ON_TARGET'
  | 'CHEST_EMPTY'
  | 'NOT_ADJACENT'
  | 'NO_ROOM_FOR_LOOT'
  | 'BAG_FULL';

export const CHEST_REFUSAL_MESSAGES: Record<ChestRefusal, string> = {
  NO_HERO: 'No hero here.',
  STANDING_ON_TARGET: 'Step off first.',
  CHEST_EMPTY: 'Nothing is left in it.',
  NOT_ADJACENT: 'Stand next to it first.',
  NO_ROOM_FOR_LOOT: 'No room around it for the loot.',
  BAG_FULL: 'Your bag is too full.',
};

const LOOT_TARGET_KEYS: readonly THexobjectKey[] = [
  HEXOBJECT_KEYS.CHEST,
  HEXOBJECT_KEYS.CHEST_OPEN,
  HEXOBJECT_KEYS.GRAVE,
];

export interface ChestWorld {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  loot?: ChestLootContext;
}

export type ChestOpeningPlan =
  { ok: true; plan: ChestLootPlan } | { ok: false; reason: ChestRefusal };

export function isChestOpening(tile: HexTileModel, actionType: EHexActionType): boolean {
  const key = tile.hexobject?.hexobjectKey;
  return (
    actionType === EHexActionType.OPEN &&
    (key === HEXOBJECT_KEYS.CHEST || key === HEXOBJECT_KEYS.CHEST_OPEN)
  );
}

function tileAt(map: HexMapModel, at: IHexCoordinates): HexTileModel | undefined {
  return map.tiles.find(
    (tile) =>
      tile.coordinates.columnIndex === at.columnIndex && tile.coordinates.rowIndex === at.rowIndex,
  );
}

export function chestRefusal(
  world: ChestWorld,
  tile: HexTileModel,
  heroId: string,
): ChestRefusal | null {
  const hero = world.heroes[heroId];
  if (!hero) return 'NO_HERO';
  const standingKey = tileAt(world.map, hero.coordinates)?.hexobject?.hexobjectKey;
  if (standingKey && LOOT_TARGET_KEYS.includes(standingKey)) return 'STANDING_ON_TARGET';
  if (tile.hexobject?.hexobjectKey !== HEXOBJECT_KEYS.CHEST) return 'CHEST_EMPTY';
  return hexDistance(hero.coordinates, tile.coordinates) === 1 ? null : 'NOT_ADJACENT';
}

export function rejectedLoot(heroId: string, reason: ChestRefusal): DomainEvent {
  return { type: 'LOOT_REJECTED', payload: { heroId, reason } };
}

export function planChestOpening(
  world: ChestWorld,
  tile: HexTileModel,
  heroId: string,
  inventory: IInventoryDraft,
): ChestOpeningPlan {
  const refusal = chestRefusal(world, tile, heroId);
  if (refusal) return { ok: false, reason: refusal };
  const entry = world.heroes[heroId].coordinates;
  const loot = planChestLoot(world.map, tile, entry, world.loot, inventory);
  return loot.ok ? loot : { ok: false, reason: loot.reason };
}

export function openChest(
  world: ChestWorld,
  tile: HexTileModel,
  heroId: string,
  plan: ChestLootPlan,
  inventory: IInventoryDraft,
): DomainEvent[] {
  const hero = world.heroes[heroId];
  const chest = { ...tile.coordinates };
  const entry = { ...hero.coordinates };
  tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST_OPEN, chest);
  hero.coordinates = { ...chest };
  revealAroundHero(world.map, chest);
  const loot = placeChestLoot({ map: world.map, chest, entry, plan, inventory });
  return [
    {
      type: 'CHEST_OPENED',
      payload: {
        heroId,
        coordinates: chest,
        from: entry,
        placed: loot.placed,
        toBag: loot.toBag,
      },
    },
  ];
}
