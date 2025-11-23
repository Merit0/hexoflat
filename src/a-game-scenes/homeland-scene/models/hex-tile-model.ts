import {
    HexTileType,
    IHexCoordinates,
} from "@/a-game-scenes/homeland-scene/interfaces/region-config-interface";

interface IHexTile {
    tileId: string;
    tileKey: string;
    tileType: HexTileType;
    imagePath: string;
    description: string;
    coordinates: IHexCoordinates;
    coordinatesToString(): string;
}

export class HexTileModel implements IHexTile {
    private _tileId: string;
    private _tileKey: string;
    private _tileType: HexTileType = 'empty';
    private _description: string = 'Nothing around';
    private _imagePath: string = '';
    private _coordinates: IHexCoordinates = {columnIndex: 0, rowIndex: 0};

    get tileId(): string {
        return this._tileId;
    }

    set tileId(tileId: string) {
        this._tileId = tileId;
    }

    get tileKey(): string {
        return this._tileKey;
    }

    set tileKey(tileKey: string) {
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
