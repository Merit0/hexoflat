import { deserializeWorld, serializeWorld } from '@hexoflat/engine';
import { coordinateKey, getHexNeighbors } from '@hexoflat/engine/utils/hex-utils';
import { isTerrainPassable } from '@hexoflat/engine/boards/terrain';
import { ensureExpedition, writeServerDocument } from '../expedition/expedition-store';
import { envelope, type TestKit } from '../player/player-test-kit';
import type { WorldService } from '../world/world.service';

export async function arriveAtQuestEntrance(
  kit: TestKit,
  world: WorldService,
  userId: string,
  heroId: string,
  adjacent = true,
) {
  await world.ensure(userId, heroId, 'camping');
  const held = deserializeWorld(await world.ensure(userId, heroId, 'silesia'), Date.now());
  const marker = held.map.tiles.find(
    (tile) => tile.hexobject?.id === held.questEntrances?.['seeker-1'],
  )!;
  const stand = getHexNeighbors(marker.coordinates).find((hex) =>
    held.map.tiles.some(
      (tile) =>
        coordinateKey(tile.coordinates) === coordinateKey(hex) &&
        !tile.hexobject &&
        isTerrainPassable(tile.terrain),
    ),
  );
  held.heroCoordinates = adjacent ? stand! : marker.coordinates;
  marker.isRevealed = true;
  const expeditionId = await ensureExpedition(kit.db, userId, heroId);
  await kit.db.transaction((tx) =>
    writeServerDocument(
      tx,
      expeditionId,
      `srv-world:${held.mapId}`,
      JSON.stringify(serializeWorld(held)),
    ),
  );
  const current = (await kit.service.snapshot(userId, heroId)).aggregates.progress!;
  const command = envelope(
    heroId,
    'ARRIVE',
    { locationKey: 'silesia', mapId: held.mapId, coordinates: held.heroCoordinates },
    current.revision,
    { aggregate: 'progress' },
  );
  delete (command.command.payload as { revision?: number }).revision;
  const result = await kit.service.execute(userId, command);
  if (result.result !== 'applied') throw new Error('Quest entrance fixture failed');
}
