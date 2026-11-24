import { CONTENT } from '../content/content-map';
import { assertDimensionRelation } from '../dimensions/relation';
import { QuestDefinitionSchema, questDimension } from './quest-definition';
import type { ProgressState } from '../aggregates/progress-state';
import { isTerrainPassable } from '../boards/terrain';
import { EHexCollision } from '../abstraction/hexobject-abstraction';
import { placeMapObject } from '../map/object-placement';
import { coordinateKey, getHexNeighbors } from '../utils/hex-utils';
import { objectDestinationAction, objectTransitionRefusal } from '../map/object-transition';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import { deriveStream } from '../utils/random-seeded';
import type { ServerWorld } from '../world/server-world';
import { ALL_QUESTS } from './all-quests';
import type { QuestCatalogue } from './quest-definition';
import type { LocationKey } from '../registry/location-key';
import type { HexTileModel } from '../map/models/hex-tile-model';
import { cloneWorldField, type SeekerEntrance } from './cloned-field';
import { questDefinitionFor } from './quest-lookup';

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

export function questPlacementMaps(
  progress: ProgressState,
  catalogue: QuestCatalogue = ALL_QUESTS,
): LocationKey[] {
  return [
    ...new Set(
      progress.quests.active.flatMap(({ questId }) => {
        const placement = questDefinitionFor(
          progress.quests,
          questId,
          catalogue,
        )?.mapObjectPlacement;
        return placement ? [placement.targetMap] : [];
      }),
    ),
  ];
}

export function installQuestEntrances(
  world: ServerWorld,
  progress: ProgressState,
  catalogue: QuestCatalogue = ALL_QUESTS,
): boolean {
  const quests = progress.quests.active.flatMap(({ questId }) => {
    const quest = questDefinitionFor(progress.quests, questId, catalogue);
    const placement = quest?.mapObjectPlacement;
    if (!quest || placement?.targetMap !== world.locationKey) return [];
    QuestDefinitionSchema.parse(quest);
    const key = placement.objectKey;
    assertDimensionRelation(`quest:${questId}`, 'place', key, CONTENT[key], questDimension(quest));
    return [{ questId, placement }];
  });
  const bindings = (world.questEntrances ??= {});
  const wanted = new Set(quests.map(({ questId }) => questId));
  let changed = false;
  for (const [questId, objectId] of Object.entries(bindings)) {
    if (wanted.has(questId)) continue;
    const tile = world.map.tiles.find((entry) => entry.hexobject?.id === objectId);
    if (tile) tile.hexobject = null;
    delete bindings[questId];
    changed = true;
  }
  const missing = quests.filter(
    ({ questId, placement }) => !placedEntranceTile(world, questId, placement.objectKey),
  );
  if (!missing.length) return changed;
  const reachable = reachableHexes(world);
  for (const { questId, placement } of missing) {
    const id = questEntranceId(questId);
    const activation = progress.quests.placementActivations?.[questId];
    const result = placeMapObject(
      world.map,
      placement.objectKey,
      {
        strategy: placement.strategy,
        random: deriveStream(world.worldSeed, activation ? `${id}:${activation}` : id),
      },
      {
        occupied: world.heroCoordinates ? [world.heroCoordinates] : [],
        eligible: (tile) => reachable.has(coordinateKey(tile.coordinates)),
      },
    );
    if (!result.ok) continue;
    bindings[questId] = result.object.id;
    changed = true;
  }
  return changed;
}

function placedEntranceTile(
  world: ServerWorld,
  questId: string,
  objectKey: THexobjectKey,
): HexTileModel | undefined {
  const objectId = world.questEntrances?.[questId];
  return objectId
    ? world.map.tiles.find(
        (tile) => tile.hexobject?.hexobjectKey === objectKey && tile.hexobject.id === objectId,
      )
    : undefined;
}

export function questEntrancePlacementIsValid(
  world: ServerWorld,
  progress: ProgressState,
  questId: string,
): boolean {
  const placement = questDefinitionFor(progress.quests, questId)?.mapObjectPlacement;
  return (
    placement?.targetMap !== world.locationKey ||
    !!placedEntranceTile(world, questId, placement.objectKey)
  );
}

function entranceTile(
  world: ServerWorld,
  questId: string,
  catalogue: QuestCatalogue,
): HexTileModel | null {
  const quest = catalogue[questId];
  if (!quest?.locations.includes(world.locationKey)) return null;
  const placement = quest.mapObjectPlacement;
  if (world.locationKey !== placement?.targetMap) return null;
  const tile = placedEntranceTile(world, questId, placement.objectKey);
  if (!tile?.hexobject) return null;
  const action = objectDestinationAction(tile.hexobject, 'QUEST');
  if (action === null) return null;
  const refusal = objectTransitionRefusal(
    tile,
    world.heroCoordinates,
    !!(world.battle || world.engagement),
    action,
    HEXOBJECT_KEYS.HAND,
  );
  return refusal === null ? tile : null;
}

export function questEntranceFor(
  world: ServerWorld,
  questId: string,
  catalogue: QuestCatalogue = ALL_QUESTS,
): SeekerEntrance | null {
  const tile = entranceTile(world, questId, catalogue);
  if (!tile || !world.heroCoordinates) return null;
  return {
    field: cloneWorldField(world, tile.coordinates),
    start: { ...world.heroCoordinates },
  };
}
