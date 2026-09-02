import type HexMapModel from '../map/models/hex-map-model';
import type { TFogPolicy } from '../map/models/hex-map-model';
import { HexMapProvider } from '../map/providers/hex-map-provider';
import { generateWorldMap, type WorldMapMvpResult } from '../generators/world-map-generator';
import type { TWorldArchetypeKey } from '../content/world-section-schema';
import { HEXOBJECT_KEYS, THexobjectKey } from './hexobjects-registry';
import type { LocationKey } from './location-key';

export type { LocationKey };

export type MapDefinition = {
  key: LocationKey;
  title: string;
  create: (seed?: string) => HexMapModel;
  generate?: (seed: string, archetype?: TWorldArchetypeKey) => WorldMapMvpResult;
  entryHexobjectKey: THexobjectKey;
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
      create: () => HexMapProvider.getCamping(),
      entryHexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
      safeZoneRadius: 1,
      fogPolicy: 'ALL_REVEALED',
    },
    silesia: {
      key: 'silesia',
      title: 'Silesia',
      create: (seed?: string) =>
        generateWorldMap({ seed: seed ?? crypto.randomUUID(), archetype: 'FORKED_FRONTIER' }).map,
      generate: (seed: string, archetype: TWorldArchetypeKey = 'FORKED_FRONTIER') =>
        generateWorldMap({ seed, archetype }),
      entryHexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
      safeZoneRadius: 1,
      fogPolicy: 'FOG',
    },
    cave: {
      key: 'cave',
      title: 'Skeletor Kingdom',
      create: () => HexMapProvider.getSkeletorsKingdom(),
      entryHexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
      safeZoneRadius: 1,
      fogPolicy: 'FOG',
      respawnAfterClearedMs: 60_000,
    },
  };

  static get(key: LocationKey): MapDefinition {
    return this.defs[key];
  }
}
