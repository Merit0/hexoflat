import {RouteName} from "@/router/routes";

export type TerrainType =
    'no-terrain'
    | 'forest'
    | 'deep-forest'
    | 'deep-sea'
    | 'sea'
    | 'mountain'
    | 'desert'
    | 'deep-desert'
    | 'swamp'
    | 'evil-portal'
    | 'field'
    | 'monster-prison'
    | 'camp';

export type HexTileType =
    'terrain'
    | 'hero'
    | 'empty'
    | 'home'
    | 'enemy'
    | 'blocked'
    | 'evil-portal'
    | 'monster-prison';

export interface IRegionConfig {
    key: string;
    terrain: TerrainType;
    name?: string;
    coordinates: [number, number][];
    images?: string[];
    backgroundImgPath?: string;
    requiredMyriads?: number;
}

export interface IHexCoordinates {
    columnIndex: number;
    rowIndex: number;
}

export interface IHexMapConfig {
    key?: RouteName;
    placeType: HexTileType;
    description: string;
    coordinates: IHexCoordinates[];
    backgroundImgPath?: string;
    images?: string[];
}