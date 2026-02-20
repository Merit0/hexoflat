import {
    IHexCoordinates,
} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {RouteName} from "@/router/routes";
import {THexobject} from "@/abstraction/hexobject-abstraction";
import {IHexResourceSpawner} from "@/abstraction/hex-resource-spawner";
import {IPendingTileAction} from "@/abstraction/hex-tile-abstraction";

export interface IHexTile {
    tileId: string;
    hexBackgroundImagePath: string;
    isRevealed: boolean;
    coordinates: IHexCoordinates;
    coordinatesToString(): string;
    hexobject: THexobject | null;
    resourceSpawner: IHexResourceSpawner | null;
    pendingAction: IPendingTileAction | null;

}

export class HexTileModel implements IHexTile {
    private _tileId: string;
    private _tileKey?: RouteName | null;
    private _isRevealed = false;
    private _hexBackgroundImagePath: string = '';
    private _hexobject: THexobject | null = null;
    private _coordinates: IHexCoordinates = {columnIndex: 0, rowIndex: 0};
    private _resourceSpawner: IHexResourceSpawner = null;
    private _pendingAction: IPendingTileAction | null = null;

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

    get resourceSpawner(): IHexResourceSpawner {
        return this._resourceSpawner;
    }

    set resourceSpawner(resourceSpawner: IHexResourceSpawner) {
        this._resourceSpawner = resourceSpawner;
    }

    get pendingAction(): IPendingTileAction {
        return this._pendingAction;
    }

    set pendingAction(pendingAction: IPendingTileAction) {
        this._pendingAction = pendingAction;
    }

    coordinatesToString(): string {
        return `${this.coordinates.columnIndex},${this.coordinates.rowIndex}`;
    }
}