import { IHexCoordinates } from '../interfaces/hex-tile-config-interface';
import { RouteName } from '../route-name';
import { THexobject } from '../../abstraction/hexobject-abstraction';
import { IHexResourceSpawner } from '../../abstraction/hex-resource-spawner';
import { IPendingTileAction } from '../../abstraction/hex-tile-abstraction';
import { promoteDiscovery, type DiscoveryState } from '../discovery-state';

export interface IHexTile {
  tileId: string;
  hexBackgroundImagePath: string;
  discovery: DiscoveryState;
  isRevealed: boolean;
  coordinates: IHexCoordinates;
  coordinatesToString(): string;
  hexobject: THexobject | null;
  resourceSpawner: IHexResourceSpawner | null;
  pendingAction: IPendingTileAction | null;
}

export class HexTileModel implements IHexTile {
  private _tileId = '';
  private _tileKey: RouteName | null = null;
  private _discovery: DiscoveryState = 'UNKNOWN';
  private _hexBackgroundImagePath: string = '';
  private _hexobject: THexobject | null = null;
  private _coordinates: IHexCoordinates = { columnIndex: 0, rowIndex: 0 };
  private _resourceSpawner: IHexResourceSpawner | null = null;
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

  get discovery(): DiscoveryState {
    return this._discovery;
  }

  set discovery(discovery: DiscoveryState) {
    this._discovery = discovery;
  }

  /**
   * Compatibility shim over `discovery`, kept for the whole exploration slice.
   *
   * Reading it answers "does the player know this hex exists at all?", which
   * is exactly what every pre-slice caller meant by it — the renderer,
   * `move-planner.isEnterableTile`, `combat-rules`, `ai-controller`, the save
   * format. None of them were migrated in E1 and none of them need to be:
   * that clean-up happens after the Stop Gate (workflow §3.2).
   *
   * Writing `true` promotes an unknown hex to `DISCOVERED` — the honest
   * translation of "reveal this", and what `combat-store.ts` does when it
   * uncovers a tile. It deliberately does **not** demote: an `UNDERSTOOD`
   * hex stays understood, because a boolean caller has no way to express
   * "the player now knows less", and letting it say so by accident would
   * quietly break invariant I10. Writing `false` is the one real reset
   * (`initFog` on a fogged map) and does go all the way back to `UNKNOWN`.
   */
  get isRevealed(): boolean {
    return this._discovery !== 'UNKNOWN';
  }

  set isRevealed(isRevealedStatus: boolean) {
    this._discovery = isRevealedStatus
      ? promoteDiscovery(this._discovery, 'DISCOVERED')
      : 'UNKNOWN';
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

  get resourceSpawner(): IHexResourceSpawner | null {
    return this._resourceSpawner;
  }

  set resourceSpawner(resourceSpawner: IHexResourceSpawner | null) {
    this._resourceSpawner = resourceSpawner;
  }

  get pendingAction(): IPendingTileAction | null {
    return this._pendingAction;
  }

  set pendingAction(pendingAction: IPendingTileAction | null) {
    this._pendingAction = pendingAction;
  }

  coordinatesToString(): string {
    return `${this.coordinates.columnIndex},${this.coordinates.rowIndex}`;
  }
}
