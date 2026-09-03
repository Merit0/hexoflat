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
  FrontierPromise,
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
import { placePromises } from './world-map-promises';
import { reserveAnchors, type GameplayAnchor } from './world-map-anchors';

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
  promises: FrontierPromise[];
  anchors: GameplayAnchor[];
  validation: WorldValidation;
  attempts: number;
}

export interface GenerateWorldMapInput {
  seed: string;
  archetype?: TWorldArchetypeKey;
  config?: WorldMapMvpConfig;
}

function tileAt(map: HexMapModel, coord: IHexCoordinates): HexTileModel | undefined {
  const key = coordinateKey(coord);
  return map.tiles.find((t) => coordinateKey(t.coordinates) === key);
}

function pickArchetype(
  seed: string,
  weights: Partial<Record<TWorldArchetypeKey, number>>,
): TWorldArchetypeKey {
  const entries = WORLD_ARCHETYPES.map((a) => [a.key, weights[a.key] ?? a.weight] as const).filter(
    ([, w]) => w > 0,
  );
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = deriveStream(seed, 'archetype')() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
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

interface Attempt {
  world: AssembledWorld;
  campAnchor: IHexCoordinates;
  heroSpawn: IHexCoordinates;
  promises: FrontierPromise[];
  anchors: GameplayAnchor[];
}

function buildAttempt(
  seed: string,
  requiredTags: TWorldSectionTag[],
  config: WorldMapMvpConfig,
): Attempt {
  const world = assembleWorld({
    seed,
    sections: WORLD_SECTIONS,
    requiredTags,
    maxSections: 24,
    targetHexes: config.growTargetHexes,
    maxHexes: config.knownHexMax,
    targetLoops: config.targetLoops,
    minAreas: 4,
  });
  const campAnchor = decorate(world);
  const heroSpawn =
    findFreeHexNear(world.map, campAnchor, deriveStream(seed, 'hero-spawn')) ?? campAnchor;
  const promises = placePromises(world.openSeams, campAnchor, seed, config);
  const anchors = reserveAnchors(world, promises, seed);
  return { world, campAnchor, heroSpawn, promises, anchors };
}

export function generateWorldMap(input: GenerateWorldMapInput): WorldMapMvpResult {
  const config = input.config ?? DEFAULT_WORLD_MAP_CONFIG;
  const archetype = input.archetype ?? pickArchetype(input.seed, config.archetypeWeights);
  const recipe = WORLD_ARCHETYPES.find((a) => a.key === archetype);
  if (!recipe) throw new Error(`generateWorldMap: no archetype "${archetype}"`);

  let best: { attempt: Attempt; validation: WorldValidation } | null = null;

  for (let i = 0; i <= config.maxSeedAttempts; i += 1) {
    const attempt = buildAttempt(subSeed(input.seed, i), recipe.requiredTags, config);
    const validation = validateWorld({
      world: attempt.world,
      campAnchor: attempt.campAnchor,
      config,
      requiredTags: recipe.requiredTags,
      promises: attempt.promises,
    });

    if (validation.accepted) {
      return toResult(input.seed, archetype, attempt, validation, i + 1);
    }
    if (!best || validation.score > best.validation.score) {
      best = { attempt, validation };
    }
  }

  return toResult(
    input.seed,
    archetype,
    best!.attempt,
    best!.validation,
    config.maxSeedAttempts + 1,
  );
}

function toResult(
  seed: string,
  archetype: TWorldArchetypeKey,
  attempt: Attempt,
  validation: WorldValidation,
  attempts: number,
): WorldMapMvpResult {
  return {
    seed,
    archetype,
    versionId: `${WORLD_MAP_GENERATOR_VERSION}:${seed}:${archetype}`,
    map: attempt.world.map,
    terrainByCoord: attempt.world.terrainByCoord,
    campAnchor: attempt.campAnchor,
    heroSpawn: attempt.heroSpawn,
    openSeams: attempt.world.openSeams,
    placedSections: attempt.world.placedSections,
    promises: attempt.promises,
    anchors: attempt.anchors,
    validation,
    attempts,
  };
}
