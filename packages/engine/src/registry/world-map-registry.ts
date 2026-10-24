import type HexMapModel from '../map/models/hex-map-model';
import type { TFogPolicy } from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS, THexobjectKey } from './hexobjects-registry';
import type { LocationKey } from './location-key';
import type { BoardDescriptor } from '../boards/board-descriptors';
import { runBoardPipeline } from '../boards/pipeline/run-board-pipeline';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { CAMPING_RECIPE, SILESIA_RECIPE } from '../content/boards/recipes';
import { CAVE_MODEL } from '../content/boards/models/cave';
import type { StaticBoardDrawing } from '../content/boards/schemas';
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
  boardKind: 'STATIC' | 'DUNGEON';
  create: (ctx: CreateBoardContext) => CreatedBoard;
  staticDrawing?: StaticBoardDrawing;
  entryHexobjectKey: THexobjectKey;
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

export class MapRegistry {
  private static defs: Record<LocationKey, MapDefinition> = {
    camping: {
      key: 'camping',
      title: 'Camping',
      boardKind: 'STATIC',
      create: () => runBoardPipeline(CAMPING_RECIPE, { seed: '' }),
      staticDrawing: CAMPING_BOARD,
      entryHexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
      safeZoneRadius: 1,
      fogPolicy: 'ALL_REVEALED',
      willZone: 'free',
    },
    silesia: {
      key: 'silesia',
      title: 'Silesia',
      boardKind: 'STATIC',
      create: () => runBoardPipeline(SILESIA_RECIPE, { seed: '' }),
      staticDrawing: SILESIA_BOARD,
      entryHexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      safeZoneRadius: 1,
      fogPolicy: 'FOG',
    },
    cave: {
      key: 'cave',
      title: 'Skeletor Kingdom',
      boardKind: 'DUNGEON',
      create: (ctx) => runBoardPipeline(CAVE_MODEL, { seed: ctx.seed, params: ctx.params }),
      entryHexobjectKey: HEXOBJECT_KEYS.CAVE_EXIT,
      safeZoneRadius: 1,
      fogPolicy: 'FOG',
      respawnAfterClearedMs: 60_000,
    },
  };

  static get(key: LocationKey): MapDefinition {
    return this.defs[key];
  }
}
