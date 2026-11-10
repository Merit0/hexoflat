import { z } from 'zod';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { isEnterableTile } from '../hero-movement/move-planner';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { getHexNeighbors } from '../utils/hex-utils';
import type { ServerWorld } from './server-world';
import { diffTiles, snapshotTiles, type TileDiff } from './tile-diff';

const KNOWN_KEYS = new Set<string>(Object.values(HEXOBJECT_KEYS));

export const worldFixtureSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('place-hexobject'),
      key: z.string().refine((key) => KNOWN_KEYS.has(key)),
    })
    .strict(),
]);

export type WorldFixture = z.infer<typeof worldFixtureSchema>;

export interface WorldFixtureResult {
  coordinates: { columnIndex: number; rowIndex: number };
  tileDiffs: TileDiff[];
}

export function applyWorldFixture(
  world: ServerWorld,
  fixture: WorldFixture,
): WorldFixtureResult | null {
  const at = world.heroCoordinates;
  if (!at) return null;
  const spot = getHexNeighbors(at).find((coord) => isEnterableTile(world.map, coord));
  const tile = spot
    ? world.map.tiles.find(
        (candidate) =>
          candidate.coordinates.columnIndex === spot.columnIndex &&
          candidate.coordinates.rowIndex === spot.rowIndex,
      )
    : undefined;
  if (!spot || !tile) return null;
  const before = snapshotTiles(world.map);
  tile.hexobject = HexObjectFactory.create(fixture.key as THexobjectKey, spot);
  return {
    coordinates: { columnIndex: spot.columnIndex, rowIndex: spot.rowIndex },
    tileDiffs: diffTiles(before, world.map),
  };
}
