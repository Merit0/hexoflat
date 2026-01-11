import {
    HexTileType,
    IHexCoordinates,
} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {RouteName} from "@/router/routes";
import {THexobject} from "@/abstraction/hexobject-abstraction";

export interface IHexTile {
    tileId: string;
    tileKey?: RouteName | null;
    tileType: HexTileType;
    hexBackgroundImagePath: string;
    isRevealed: boolean;
    coordinates: IHexCoordinates;
    coordinatesToString(): string;
    hexobject: THexobject | null;
}

export class HexTileModel implements IHexTile {
    private _tileId: string;
    private _tileKey?: RouteName | null;
    private _tileType: HexTileType = 'empty';
    private _isRevealed = false;
    private _hexBackgroundImagePath: string = '';
    private _hexobject: THexobject | null = null;
    private _coordinates: IHexCoordinates = {columnIndex: 0, rowIndex: 0};

    get hexobject(): THexobject | null {
        return this._hexobject;
    }

    set hexobject(hexobject: THexobject | null) {
        this._hexobject = hexobject;
    }

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

    get coordinates(): IHexCoordinates {
        return this._coordinates;
    }

    set coordinates(coordinates: IHexCoordinates) {
        this._coordinates = coordinates;
    }

    get hexBackgroundImagePath(): string {
        return this._hexBackgroundImagePath;
    }

    set hexBackgroundImagePath(imagPath: string) {
        this._hexBackgroundImagePath = imagPath;
    }

    coordinatesToString(): string {
        return `${this.coordinates.columnIndex},${this.coordinates.rowIndex}`;
    }
}
