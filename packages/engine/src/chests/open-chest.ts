import type { DomainEvent } from '../commands/types';
import { accessRefusal, type ContainerRefusal } from '../containers';
import { EHexActionType } from '../enums/hex-action-type';
import type { HeroState } from '../hero-movement/hero-state';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import type HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey, offsetToAxial } from '../utils/hex-utils';
import type { ChestLootContext } from './plan-chest-loot';

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
}

export function isChestOpening(tile: HexTileModel, actionType: EHexActionType): boolean {
  const key = tile.hexobject?.hexobjectKey;
  return (
    actionType === EHexActionType.OPEN &&
    (key === HEXOBJECT_KEYS.CHEST || key === HEXOBJECT_KEYS.CHEST_OPEN)
  );
}

export function chestRefusal(
  world: ChestWorld,
  tile: HexTileModel,
  heroId: string,
): ChestRefusal | null {
  const hero = world.heroes[heroId];
  if (!hero) return 'NO_HERO';
  return accessRefusal({
    actorAt: offsetToAxial(hero.coordinates),
    standing: standsOnLootTarget(world, hero.coordinates),
    container: {
      id: coordinateKey(tile.coordinates),
      kind: 'chest',
      at: offsetToAxial(tile.coordinates),
      contents: null,
      status: tile.hexobject?.hexobjectKey === HEXOBJECT_KEYS.CHEST ? 'full' : 'empty',
    },
  });
}

function standsOnLootTarget(world: ChestWorld, at: IHexCoordinates): boolean {
  const key = world.map.tiles.find((t) => coordinateKey(t.coordinates) === coordinateKey(at))
    ?.hexobject?.hexobjectKey;
  return (
    key === HEXOBJECT_KEYS.CHEST ||
    key === HEXOBJECT_KEYS.CHEST_OPEN ||
    key === HEXOBJECT_KEYS.GRAVE
  );
}

export function rejectedLoot(heroId: string, reason: ChestRefusal): DomainEvent {
  return { type: 'LOOT_REJECTED', payload: { heroId, reason } };
}
