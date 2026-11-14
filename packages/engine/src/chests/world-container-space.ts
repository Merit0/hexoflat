import type { DomainEvent } from '../commands/types';
import {
  emptiedContainer,
  type ContainerRefusal,
  type ContainerSpace,
  type ContainerState,
} from '../containers';
import { EHexActionType } from '../enums/hex-action-type';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { applySpreadPlan, offsetPlacement } from '../loot';
import { revealAroundHero } from '../map/fog-service';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { axialToOffset, coordinateKey, offsetToAxial } from '../utils/hex-utils';
import {
  CHEST_REFUSAL_MESSAGES,
  rejectedLoot,
  type ChestRefusal,
  type ChestWorld,
} from './open-chest';
import { chestNeighbours, rollChestLoot } from './plan-chest-loot';

const LOOT_TARGET_KEYS: readonly THexobjectKey[] = [
  HEXOBJECT_KEYS.CHEST,
  HEXOBJECT_KEYS.CHEST_OPEN,
  HEXOBJECT_KEYS.GRAVE,
];

function tileAt(world: ChestWorld, at: IHexCoordinates) {
  return world.map.tiles.find((tile) => coordinateKey(tile.coordinates) === coordinateKey(at));
}

export function worldChestSpace(
  actionType: EHexActionType,
): ContainerSpace<ChestWorld, IHexCoordinates, 'NO_HERO'> {
  return {
    preconditions: (world, heroId) => (world.heroes[heroId] ? null : 'NO_HERO'),
    actorAt: (world, heroId) => offsetToAxial(world.heroes[heroId].coordinates),
    standsOnContainer: (world, heroId) => {
      const key = tileAt(world, world.heroes[heroId].coordinates)?.hexobject?.hexobjectKey;
      return !!key && LOOT_TARGET_KEYS.includes(key);
    },
    containerAt: (world, target): ContainerState | null => {
      const key = tileAt(world, target)?.hexobject?.hexobjectKey;
      if (key !== HEXOBJECT_KEYS.CHEST && key !== HEXOBJECT_KEYS.CHEST_OPEN) return null;
      const stored = tileAt(world, target)?.hexobject?.container;
      return {
        id: coordinateKey(target),
        kind: 'chest',
        at: offsetToAxial(target),
        contents: stored?.contents ?? null,
        status: stored?.status ?? (key === HEXOBJECT_KEYS.CHEST ? 'full' : 'empty'),
      };
    },
    neighbours: (world, container) => chestNeighbours(world.map, container.at),
    rollContents: (world, container) => {
      const tile = tileAt(world, axialToOffset(container.at))!;
      return [rollChestLoot(tile, world.loot)];
    },
    apply: (world, heroId, container, outcome, bag): DomainEvent[] => {
      const hero = world.heroes[heroId];
      const chest = axialToOffset(container.at);
      const entry = { ...hero.coordinates };
      const tile = tileAt(world, chest)!;
      tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CHEST_OPEN, chest, {
        container: emptiedContainer(outcome.container),
      });
      if (!outcome.nothing) {
        hero.coordinates = { ...chest };
        revealAroundHero(world.map, chest);
      }
      const byKey = new Map(world.map.tiles.map((t) => [coordinateKey(t.coordinates), t]));
      const applied = applySpreadPlan(outcome.plan, bag, (placement) => {
        const placed = offsetPlacement(placement, 'coordinates');
        const target = byKey.get(coordinateKey(placed.coordinates));
        if (target) {
          target.hexobject = HexObjectFactory.create(placed.itemKey, placed.coordinates, {
            quantity: placed.amount,
          });
        }
        return placed;
      });
      return [
        {
          type: 'CHEST_OPENED',
          payload: {
            heroId,
            coordinates: chest,
            from: entry,
            placed: applied.placed,
            toBag: applied.toBag,
          },
        },
      ];
    },
    refusalEvents: (_world, heroId, target, reason: ChestRefusal | ContainerRefusal) => [
      rejectedLoot(heroId, reason),
      {
        type: 'HEX_ACTION_START_REJECTED',
        payload: {
          coordinates: target,
          actionType,
          message: CHEST_REFUSAL_MESSAGES[reason],
        },
      },
    ],
  };
}
