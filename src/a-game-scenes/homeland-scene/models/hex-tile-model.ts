import {
    HexTileType,
    IHexCoordinates, IResourceConfig, TResourceKind,
} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {RouteName} from "@/router/routes";
import {HexTileBuilder} from "@/a-game-scenes/homeland-scene/builders/hex-tile-builder";

export interface IHexTile {
    tileId: string;
    tileKey?: RouteName | null;
    tileType: HexTileType;
    imagePath: string;
    description: string;
    isRevealed: boolean;
    coordinates: IHexCoordinates;
    resource: IResourceConfig | undefined;
    coordinatesToString(): string;
}

export class HexTileModel implements IHexTile {
    private _tileId: string;
    private _tileKey?: RouteName | null;
    private _tileType: HexTileType = 'empty';
    private _isRevealed = false;
    private _description: string = 'Nothing around';
    private _imagePath: string = '';
    private _coordinates: IHexCoordinates = {columnIndex: 0, rowIndex: 0};
    private _resource?: {
        kind: TResourceKind;
        resourceImagePaths?: string[];
        resourceDescription?: string;
        regrowAt?: number | null;
        regrowMs?: number;
        isAvailable?: boolean;
    };

    get tileId(): string {
        return this._tileId;
    }

    set tileId(tileId: string) {
        this._tileId = tileId;
    }

    get isRevealed(): boolean {
        return this._isRevealed;
    }

    set isRevealed(isRevealedStatus: boolean) {
        this._isRevealed = isRevealedStatus;
    }

    get tileKey(): RouteName | null {
        return this._tileKey;
    }

    set tileKey(tileKey: RouteName) {
        this._tileKey = tileKey;
    }

    get tileType(): HexTileType {
        return this._tileType;
    }

    set tileType(tileType: HexTileType) {
        this._tileType = tileType;
    }

    get description(): string {
        return this._description;
    }

    set description(description: string) {
        this._description = description;
    }

    get coordinates(): IHexCoordinates {
        return this._coordinates;
    }

    set coordinates(coordinates: IHexCoordinates) {
        this._coordinates = coordinates;
    }

    get imagePath(): string {
        return this._imagePath;
    }

    set imagePath(imagPath: string) {
        this._imagePath = imagPath;
    }

    get resource(): IResourceConfig {
        return this._resource;
    }

    set resource(resource: IResourceConfig) {
        this._resource = resource;
    }

    coordinatesToString(): string {
        return `${this.coordinates.columnIndex},${this.coordinates.rowIndex}`;
    }


    static fromJSON(raw: any): HexTileModel {
        return new HexTileBuilder()
            .tileId(raw.tileId)
            .routeKey(raw.tileKey)
            .type(raw.tileType)
            .isRevealed(raw.isRevealed)
            .imagePath(raw.imagePath)
            .coordinates(raw.coordinates)
            .build();
    }
}
