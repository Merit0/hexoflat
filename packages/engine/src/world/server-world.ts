import { z } from 'zod';
import { CONTENT_VERSION } from '../content/content-version';
import { initFog, revealAroundHero, revealEntryTile } from '../map/fog-service';
import { installCampBook } from '../knowledge/camp-book';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import HexMapModel, { type ISerializedHexMap } from '../map/models/hex-map-model';
import { findTilesMissingSpawners } from '../map/resource-hydration';
import { LOCATION_KEYS, type LocationKey } from '../registry/location-key';
import { MapRegistry } from '../registry/world-map-registry';
import type { BoardDescriptor } from '../boards/board-descriptors';
import { deriveStream } from '../utils/random-seeded';
import { applyCommand } from '../commands/apply-command';
import { engagementSchema, type Engagement } from '../squads/engagement';
import { createRecordingPorts } from './server-ports';
import { findEntryHex } from './hero-placement';

export interface ServerWorld {
  locationKey: LocationKey;
  mapId: string;
  map: HexMapModel;
  descriptor: BoardDescriptor | null;
  heroCoordinates: IHexCoordinates | null;
  worldSeed: string;
  engagement: Engagement | null;
}

const MAP_ORIGIN: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };

export const serializedWorldSchema = z.object({
  contentVersion: z.literal(CONTENT_VERSION),
  locationKey: z.enum(LOCATION_KEYS),
  mapId: z.string().min(1),
  map: z.custom<ISerializedHexMap>((value) => typeof value === 'object' && value !== null),
  descriptor: z.unknown().nullable(),
  heroCoordinates: z
    .object({ columnIndex: z.number().int(), rowIndex: z.number().int() })
    .nullable(),
  worldSeed: z.string().min(1),
  engagement: engagementSchema.nullable().default(null),
});
export type SerializedWorld = z.infer<typeof serializedWorldSchema>;

export function serializeWorld(world: ServerWorld): SerializedWorld {
  return {
    contentVersion: CONTENT_VERSION,
    locationKey: world.locationKey,
    mapId: world.mapId,
    map: world.map.toJSON(),
    descriptor: world.descriptor,
    heroCoordinates: world.heroCoordinates,
    worldSeed: world.worldSeed,
    engagement: world.engagement,
  };
}

export function deserializeWorld(raw: unknown, now: number): ServerWorld {
  const parsed = serializedWorldSchema.parse(raw);
  return {
    locationKey: parsed.locationKey,
    mapId: parsed.mapId,
    map: HexMapModel.fromJSON(parsed.map, now),
    descriptor: parsed.descriptor as BoardDescriptor | null,
    heroCoordinates: parsed.heroCoordinates,
    worldSeed: parsed.worldSeed,
    engagement: parsed.engagement,
  };
}

export function createServerWorld(
  locationKey: LocationKey,
  mapId: string,
  expeditionSeed: string,
  heroId: string,
): ServerWorld {
  const worldSeed = `${expeditionSeed}:${mapId}`;
  const created = MapRegistry.get(locationKey).create({ seed: worldSeed });
  const { map } = created;
  initFog(map);

  const { ctx } = createRecordingPorts();
  for (const { tile, hexobject } of findTilesMissingSpawners(map)) {
    applyCommand(
      { map, heroes: {} },
      {
        type: 'ADD_RESOURCE_SPAWNER',
        payload: { heroId, coordinates: tile.coordinates, hexobject },
      },
      ctx,
    );
  }
  if (locationKey === 'camping') installCampBook(map, null);

  const entry = findEntryHex(map, locationKey, deriveStream(worldSeed, 'world')) ?? {
    ...MAP_ORIGIN,
  };
  revealAroundHero(map, entry);
  revealEntryTile(map);

  return {
    locationKey,
    mapId,
    map,
    descriptor: created.descriptor,
    heroCoordinates: entry,
    worldSeed,
    engagement: null,
  };
}
