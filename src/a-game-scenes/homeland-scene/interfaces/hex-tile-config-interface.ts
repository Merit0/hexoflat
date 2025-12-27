import {RouteName} from "@/router/routes";

export type HexTileType =
    | 'resource'
    | 'empty'
    | 'home'
    | 'enemy';

export type TResourceKind =
    'tree'
    | 'rock'
    | 'ore'
    | 'herb';

export interface IResourceConfig {
    kind: TResourceKind;
    regrowMs?: number;
    resourceImagePaths?: string[];
    resourceDescription?: string;
}

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
    resource?: IResourceConfig;
}