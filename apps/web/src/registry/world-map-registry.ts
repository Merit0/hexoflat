import type HexMapModel from '@/a-game-scenes/map-scene/models/hex-map-model';
import type { TFogPolicy } from '@/a-game-scenes/map-scene/models/hex-map-model';
import { HexMapProvider } from '@/a-game-scenes/map-scene/providers/hex-map-provider';
import { HEXOBJECT_KEYS, THexobjectKey } from '@/registry/hexobjects-registry';
import type { LocationKey } from '@/registry/location-key';

export type { LocationKey };

export type MapDefinition = {
  key: LocationKey;
  title: string;
  create: () => HexMapModel;
  entryHexobjectKey: THexobjectKey;
  safeZoneRadius?: number;
  fogPolicy?: TFogPolicy;
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
      create: () => HexMapProvider.getHomeLand(),
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
    },
  };

  static get(key: LocationKey): MapDefinition {
    return this.defs[key];
  }
}
