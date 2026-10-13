import type HexMapModel from '../map/models/hex-map-model';
import type { TFogPolicy } from '../map/models/hex-map-model';
import { HEXOBJECT_KEYS, THexobjectKey } from './hexobjects-registry';
import type { LocationKey } from './location-key';
import type { BoardDescriptor } from '../boards/board-descriptors';
import { buildStaticBoard } from '../boards/build-static-board';
import { assembleGeneratedBoard } from '../boards/assemble-generated-board';
import { CAMPING_BOARD } from '../content/boards/static/camping';
import { SILESIA_BOARD } from '../content/boards/static/silesia';
import { CAVE_PRESET } from '../content/boards/presets/cave';
import type { StaticBoardDrawing } from '../content/boards/schemas';
import type { WillZone } from '../knowledge/will-zone';

export type { LocationKey };

export interface CreateBoardContext {
  seed: string;
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
  /** DUNGEON only — rebuild forcing one specific layout, for the dev board panel. */
  createWithLayout?: (ctx: CreateBoardContext & { layoutId: string }) => CreatedBoard;
  /** DUNGEON only — every layout id this location's preset can pick from. */
  availableLayouts?: string[];
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
      create: () => buildStaticBoard(CAMPING_BOARD, 'ALL_REVEALED'),
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
      create: () => buildStaticBoard(SILESIA_BOARD),
      staticDrawing: SILESIA_BOARD,
      entryHexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      safeZoneRadius: 1,
      fogPolicy: 'FOG',
    },
    cave: {
      key: 'cave',
      title: 'Skeletor Kingdom',
      boardKind: 'DUNGEON',
      create: (ctx) => assembleGeneratedBoard(ctx.seed, CAVE_PRESET),
      createWithLayout: (ctx) =>
        assembleGeneratedBoard(ctx.seed, { ...CAVE_PRESET, layouts: [ctx.layoutId] }),
      availableLayouts: CAVE_PRESET.layouts,
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
