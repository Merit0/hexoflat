import type { ProgressState } from '../aggregates/progress-state';
import { isTerrainPassable } from '../boards/terrain';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { placeMapObject } from '../map/object-placement';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { objectDestinationAction, objectTransitionRefusal } from '../map/object-transition';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import type { ServerWorld } from '../world/server-world';
import { ALL_QUESTS } from './all-quests';
import type { QuestCatalogue } from './quest-definition';
import type { LocationKey } from '../registry/location-key';

export const questEntranceId = (questId: string) => `quest-entrance:${questId}`;

function reachableHexes(world: ServerWorld): Set<string> {
  const byKey = new Map(world.map.tiles.map((tile) => [coordinateKey(tile.coordinates), tile]));
  const visited = new Set<string>();
  const queue = world.heroCoordinates ? [world.heroCoordinates] : [];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    const key = coordinateKey(at);
    if (visited.has(key)) continue;
    const tile = byKey.get(key);
    if (
      !tile ||
      !isTerrainPassable(tile.terrain) ||
      tile.hexobject?.collision === EHexCollision.SOLID
    )
      continue;
    visited.add(key);
    queue.push(...getHexNeighbors(at).filter((hex) => !visited.has(coordinateKey(hex))));
  }
  return visited;
}

/** Reconcile accepted expeditions without altering fog or existing map objects. */
export function questPlacementMaps(
  progress: ProgressState,
  catalogue: QuestCatalogue = ALL_QUESTS,
): LocationKey[] {
  return [
    ...new Set(
      progress.quests.active.flatMap(({ questId }) => {
        const placement = catalogue[questId]?.mapObjectPlacement;
        return placement ? [placement.targetMap] : [];
      }),
    ),
  ];
}

export function installQuestEntrances(
  world: ServerWorld,
  progress: ProgressState,
  catalogue: QuestCatalogue = ALL_QUESTS,
): void {
  const quests = progress.quests.active.filter(
    ({ questId }) => catalogue[questId]?.mapObjectPlacement?.targetMap === world.locationKey,
  );
  const wanted = new Set(quests.map(({ questId }) => questEntranceId(questId)));
  for (const tile of world.map.tiles) {
    if (tile.hexobject?.questId && !wanted.has(questEntranceId(tile.hexobject.questId ?? '')))
      tile.hexobject = null;
  }
  for (const { questId } of quests) {
    const reachable = reachableHexes(world);
    const id = questEntranceId(questId);
    const placement = catalogue[questId].mapObjectPlacement!;
    if (
      world.map.tiles.some(
        (tile) =>
          tile.hexobject?.hexobjectKey === placement.objectKey &&
          tile.hexobject.questId === questId,
      )
    )
      continue;
    const result = placeMapObject(
      world.map,
      placement.objectKey,
      {
        strategy: placement.strategy,
        random: deriveStream(world.worldSeed, id),
      },
      {
        occupied: world.heroCoordinates ? [world.heroCoordinates] : [],
        eligible: (tile) => reachable.has(coordinateKey(tile.coordinates)),
      },
    );
    if (result.ok) result.object.questId = questId;
  }
}

export function canEnterQuestWorld(
  world: ServerWorld,
  questId: string,
  catalogue: QuestCatalogue = ALL_QUESTS,
): boolean {
  const placement = catalogue[questId]?.mapObjectPlacement;
  if (world.locationKey !== placement?.targetMap) return false;
  return world.map.tiles.some((tile) => {
    if (tile.hexobject?.hexobjectKey !== placement.objectKey || tile.hexobject.questId !== questId)
      return false;
    const action = objectDestinationAction(tile.hexobject, 'QUEST');
    return (
      action !== null &&
      objectTransitionRefusal(
        tile,
        world.heroCoordinates,
        !!(world.battle || world.engagement),
        action,
        HEXOBJECT_KEYS.HAND,
      ) === null
    );
  });
}
