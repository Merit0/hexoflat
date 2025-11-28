import {IHexCoordinates} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";

export type OverlayType =
    | 'hex-tile-details'
    | 'hero-dressing-room'
    | 'battle'
    | 'chest-inventory'
    | 'shop'
    | 'mapInfo'
    | 'dialogue'
    | 'hero-inventory'
    | 'grave-inventory'
    | 'dungeon-preview'
    | 'confirm-escape-battle';

export type OverlayPayloads = {
    'hero-dressing-room': { tab?: 'body' | 'armor' | 'weapon' } | undefined;
    'battle': { enemiesIds: number[]; locationId: string };
    'chest-inventory': { chestId: string };
    'shop': { shopId: string };
    'mapInfo': { tileKey: string };
    'dialogue': { npcId: string; text?: string };
    'hero-inventory': undefined;
    'grave-inventory': { graveId: string };
    'dungeon-preview': { dungeonKey: string };
    'confirm-escape-battle': { battleId: string };
    'hex-tile-details': { coordinates: IHexCoordinates };
};
