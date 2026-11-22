import { EDimension, dimensionSchema } from '../dimensions/dimensions';
import type HexMapModel from '../map/models/hex-map-model';
import type { TFogPolicy } from '../map/models/hex-map-model';
import type { THexobjectKey } from './hexobjects-registry';
import type { LocationKey } from './location-key';
import type { BoardKind } from './board-kind';
import type { BoardDescriptor } from '../boards/board-descriptors';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { SILESIA_NORTH_BOARD } from '../content/boards/static/silesia-north';
import { CAMPING_RECIPE, SILESIA_NORTH_RECIPE, SILESIA_RECIPE } from '../content/boards/recipes';
import { CAVE_MODEL } from '../content/boards/models/cave';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import type { BoardRecipeInput } from '../content/boards/recipe-schema';
import type { WillZone } from '../knowledge/will-zone';

export type { LocationKey };

export interface CreateBoardContext {
  seed: string;
  params?: Record<string, unknown>;
}

export interface CreatedBoard {
  map: HexMapModel;
  descriptor: BoardDescriptor;
}

export type MapDefinition = {
  key: LocationKey;
  title: string;
  boardKind: BoardKind;
  dimension: EDimension;
  create: (ctx: CreateBoardContext) => CreatedBoard;
  staticDrawing?: StaticBoardDrawing;
  entryHexobjectKey?: THexobjectKey;
  willZone?: WillZone;
  safeZoneRadius?: number;
  fogPolicy?: TFogPolicy;
  /**
   * How long this location stays sealed after the hero clears it and leaves,
   * before its map is thrown away and regenerated. Omitted means the
   * location never regenerates — its map persists as the hero left it.
   */
  respawnAfterClearedMs?: number;
};

function staticLocation(
  key: LocationKey,
  title: string,
  dimension: EDimension,
  recipe: BoardRecipeInput,
  drawing: StaticBoardDrawing,
  extra: Partial<MapDefinition> = {},
): MapDefinition {
  return {
    key,
    title,
    boardKind: 'STATIC',
    dimension,
    create: () => runBoardPipeline(recipe, { seed: '' }),
    staticDrawing: drawing,
    entryHexobjectKey: recipe.entryObject,
    safeZoneRadius: 1,
    fogPolicy: recipe.fog,
    ...extra,
  };
}

export class MapRegistry {
  private static defs: Record<LocationKey, MapDefinition> = {
    camping: staticLocation('camping', 'Camping', EDimension.EARTH, CAMPING_RECIPE, CAMPING_BOARD, {
      willZone: 'free',
    }),
    silesia: staticLocation('silesia', 'Silesia', EDimension.EARTH, SILESIA_RECIPE, SILESIA_BOARD),
    'silesia-north': staticLocation(
      'silesia-north',
      'Silesia North',
      EDimension.EARTH,
      SILESIA_NORTH_RECIPE,
      SILESIA_NORTH_BOARD,
    ),
    cave: {
      key: 'cave',
      title: 'Skeletor Kingdom',
      boardKind: 'DUNGEON',
      dimension: EDimension.UNDERWORLD,
      create: (ctx) => runBoardPipeline(CAVE_MODEL, { seed: ctx.seed, params: ctx.params }),
      entryHexobjectKey: CAVE_MODEL.entryObject,
      safeZoneRadius: 1,
      fogPolicy: CAVE_MODEL.fog,
      respawnAfterClearedMs: 60_000,
    },
  };

  static get(key: LocationKey): MapDefinition {
    const definition = this.defs[key];
    dimensionSchema.parse(definition.dimension);
    return definition;
  }
}
