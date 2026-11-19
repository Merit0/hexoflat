import type { DomainEvent } from '../commands/types';
import type { ContainerRefusal } from '../containers';
import { EHexActionType } from '../enums/hex-action-type';
import type { HeroState } from '../hero-movement/hero-state';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { ChestLootContext } from './plan-chest-loot';
import type { InventoryState } from '../inventory/inventory-state';

export type ChestRefusal = 'NO_HERO' | ContainerRefusal;

export const CHEST_REFUSAL_MESSAGES: Record<ChestRefusal, string> = {
  NO_HERO: 'No hero here.',
  STANDING_ON_TARGET: 'Step off first.',
  CONTAINER_EMPTY: 'Nothing is left in it.',
  NOT_ADJACENT: 'Stand next to it first.',
  NO_ROOM_FOR_LOOT: 'No room around it for the loot.',
  BAG_FULL: 'Your bag is too full.',
};

export interface ChestWorld {
  map: HexMapModel;
  heroes: Record<string, HeroState>;
  loot?: ChestLootContext;
  inventory?: InventoryState;
}

export function isChestOpening(tile: HexTileModel, actionType: EHexActionType): boolean {
  const key = tile.hexobject?.hexobjectKey;
  return (
    actionType === EHexActionType.OPEN &&
    (key === HEXOBJECT_KEYS.CHEST || key === HEXOBJECT_KEYS.CHEST_OPEN)
  );
}

export function rejectedLoot(heroId: string, reason: ChestRefusal): DomainEvent {
  return { type: 'LOOT_REJECTED', payload: { heroId, reason } };
}
