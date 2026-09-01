import { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';

export type OverlayType =
  | 'hex-tile-details'
  | 'hero-dressing-room'
  | 'battle'
  | 'chest-inventory'
  | 'shop'
  | 'mapInfo'
  | 'dialogue'
  | 'grave-inventory'
  | 'dungeon-preview'
  | 'confirm-escape-battle'
  | 'settings';

export type OverlayPayloads = {
  'hero-dressing-room': { tab?: 'body' | 'armor' | 'weapon' } | undefined;
  battle: { enemiesIds: number[]; locationId: string };
  'chest-inventory': { chestId: string };
  shop: { shopId: string };
  mapInfo: { tileKey: string };
  dialogue: { npcId: string; text?: string };
  'grave-inventory': { graveId: string };
  'dungeon-preview': { dungeonKey: string };
  'confirm-escape-battle': { battleId: string };
  'hex-tile-details': { coordinates: IHexCoordinates };
  settings: undefined;
};
