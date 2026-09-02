import HexMapModel from '../map/models/hex-map-model';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { IHexCoordinates } from '../map/interfaces/hex-tile-config-interface';
import { HexObjectFactory } from '../factory/hex-object-factory';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { coordinateKey } from '../utils/hex-utils';
import { deriveStream } from '../utils/random-seeded';
import { sha256Hex } from '../utils/hash/sha256';
import { findFreeHexNear } from '../map/free-hex-finder';
import { WORLD_ARCHETYPES } from '../content/world-archetypes.content';
import { WORLD_SECTIONS } from '../content/world-sections.content';
import type {
  TWorldArchetypeKey,
  TWorldSectionTag,
  TWorldTerrainKey,
} from '../content/world-section-schema';
import {
  assembleWorld,
  type AssembledWorld,
  type OpenSeam,
  type PlacedSection,
} from './world-map-assembler';
import { DEFAULT_WORLD_MAP_CONFIG, type WorldMapMvpConfig } from './world-map-config';
import { validateWorld, type WorldValidation } from './world-map-validator';

export const WORLD_MAP_GENERATOR_VERSION = 'world-map-mvp-v0.1';

export interface WorldMapMvpResult {
  seed: string;
  archetype: TWorldArchetypeKey;
  versionId: string;
  map: HexMapModel;
  terrainByCoord: Record<string, TWorldTerrainKey>;
  campAnchor: IHexCoordinates;
  heroSpawn: IHexCoordinates;
  openSeams: OpenSeam[];
  placedSections: PlacedSection[];
  validation: WorldValidation;
}

export interface GenerateWorldMapInput {
  seed: string;
  archetype: TWorldArchetypeKey;
  config?: WorldMapMvpConfig;
}

function tileAt(map: HexMapModel, coord: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(coord);
  return map.tiles.find((t) => coordinateKey(t.coordinates) === key);
}

function decorate(world: AssembledWorld): IHexCoordinates {
  const campAnchor = world.placedSections[0].anchor;

  const anchorTile = tileAt(world.map, campAnchor);
  if (anchorTile) {
    anchorTile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.CAMPING_ENTRANCE, campAnchor);
  }
  world.map.config = [
    {
      hexobject: { hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE },
      coordinates: [campAnchor],
      entry: { type: 'DEFAULT' },
    },
  ];

  for (const tile of world.map.tiles) {
    if (world.terrainByCoord[coordinateKey(tile.coordinates)] !== 'STONE_RIDGE') continue;
    if (coordinateKey(tile.coordinates) === coordinateKey(campAnchor)) continue;
    tile.hexobject = HexObjectFactory.create(HEXOBJECT_KEYS.WOOD_AND_LEAVES, tile.coordinates);
  }

  return campAnchor;
}

function subSeed(seed: string, attempt: number): string {
  return attempt === 0 ? seed : sha256Hex(`${seed}:attempt:${attempt}`);
}

function buildAttempt(
  seed: string,
  requiredTags: TWorldSectionTag[],
): { world: AssembledWorld; campAnchor: IHexCoordinates; heroSpawn: IHexCoordinates } {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags,
    maxSections: requiredTags.length + 1,
  });
  const campAnchor = decorate(world);
  const heroSpawn =
    findFreeHexNear(world.map, campAnchor, deriveStream(seed, 'hero-spawn')) ?? campAnchor;
  return { world, campAnchor, heroSpawn };
}

export function generateWorldMap(input: GenerateWorldMapInput): WorldMapMvpResult {
  const config = input.config ?? DEFAULT_WORLD_MAP_CONFIG;
  const recipe = WORLD_ARCHETYPES.find((a) => a.key === input.archetype);
  if (!recipe) throw new Error(`generateWorldMap: no archetype "${input.archetype}"`);

  let best: { attempt: ReturnType<typeof buildAttempt>; validation: WorldValidation } | null = null;

  for (let i = 0; i <= config.maxSeedAttempts; i += 1) {
    const attempt = buildAttempt(subSeed(input.seed, i), recipe.requiredTags);
    const validation = validateWorld(attempt.world, attempt.campAnchor, config);

    if (validation.accepted) {
      return toResult(input, attempt, validation);
    }
    if (!best || validation.score > best.validation.score) {
      best = { attempt, validation };
    }
  }

  return toResult(input, best!.attempt, best!.validation);
}

function toResult(
  input: GenerateWorldMapInput,
  attempt: ReturnType<typeof buildAttempt>,
  validation: WorldValidation,
): WorldMapMvpResult {
  return {
    seed: input.seed,
    archetype: input.archetype,
    versionId: `${WORLD_MAP_GENERATOR_VERSION}:${input.seed}:${input.archetype}`,
    map: attempt.world.map,
    terrainByCoord: attempt.world.terrainByCoord,
    campAnchor: attempt.campAnchor,
    heroSpawn: attempt.heroSpawn,
    openSeams: attempt.world.openSeams,
    placedSections: attempt.world.placedSections,
    validation,
  };
}
