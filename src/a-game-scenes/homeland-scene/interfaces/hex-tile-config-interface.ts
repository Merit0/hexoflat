import {RouteName} from "@/router/routes";

export type HexTileType =
    'terrain'
    | 'hero'
    | 'fog'
    | 'tree'
    | 'empty'
    | 'home'
    | 'enemy'
    | 'blocked';

export interface IHexCoordinates {
    columnIndex: number;
    rowIndex: number;
}

export interface IHexMapConfig {
    key?: RouteName;
    tileType: HexTileType;
    description: string;
    coordinates: IHexCoordinates[];
    backgroundImgPath?: string;
    images?: string[];
}