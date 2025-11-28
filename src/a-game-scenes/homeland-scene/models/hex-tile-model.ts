import {
    HexTileType,
    IHexCoordinates,
} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {RouteName} from "@/router/routes";

export interface IHexTile {
    tileId: string;
    tileKey?: RouteName | null;
    tileType: HexTileType;
    imagePath: string;
    description: string;
    isRevealed: boolean;
    coordinates: IHexCoordinates;
    coordinatesToString(): string;
}

export class HexTileModel implements IHexTile {
    private _tileId: string;
    private _tileKey?: RouteName | null;
    private _tileType: HexTileType = 'fog';
    private _isRevealed = false;
    private _description: string = 'Nothing around';
    private _imagePath: string = '';
    private _coordinates: IHexCoordinates = {columnIndex: 0, rowIndex: 0};

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

    coordinatesToString(): string {
        return `${this.coordinates.columnIndex},${this.coordinates.rowIndex}`;
    }
}
