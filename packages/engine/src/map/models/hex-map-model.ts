import { Complexity } from '../../enums/complexity';
import { HexTileModel } from './hex-tile-model';
import { HexTileBuilder } from '../builders/hex-tile-builder';
import { IHexMapPlacement } from '../../abstraction/hex-map-placement';
import { IHexCoordinates } from '../interfaces/hex-tile-config-interface';
import { EHexobjectGroup, THexobject } from '../../abstraction/hexobject-abstraction';
import { HexObjectFactory } from '../../factory/hex-object-factory';
import { normalizeHealthValue } from '../../utils/combat/health-format';
import type { RouteName } from '../route-name';
import type { IHexResourceSpawner } from '../../abstraction/hex-resource-spawner';
import type { IPendingTileAction } from '../../abstraction/hex-tile-abstraction';
import { EHexActionType } from '../../enums/hex-action-type';
import { coordinateKey } from '../../utils/hex-utils';
import type { DiscoveryState } from '../discovery-state';

export type TFogPolicy = 'FOG' | 'ALL_REVEALED';

interface IWorldMap {
  name: string;
  width: number;
  height: number;
  complexity: Complexity;
  config: IHexMapPlacement[];
  tiles: HexTileModel[];
}

export interface ISerializedHexTile {
  imagePath?: string;
  tileKey?: RouteName | null;
  coordinates?: IHexCoordinates;
  // Legacy save format used flat row/column fields instead of `coordinates`.
  r?: number;
  q?: number;
  isRevealed?: boolean;
  /**
   * Added in E1. Absent in every payload written before it, which is why it
   * is optional and CONTENT_VERSION stayed at 1: the four states are a
   * refinement of `isRevealed`, not a replacement for it, so an old payload
   * reads back losslessly as `DISCOVERED`/`UNKNOWN`.
   */
  discovery?: DiscoveryState;
  hexobject?: THexobject | null;
  resourceSpawner?: IHexResourceSpawner | null;
  pendingAction?: IPendingTileAction | null;
}

export interface ISerializedHexMap {
  name: string;
  width: number;
  height: number;
  complexity: Complexity;
  config: IHexMapPlacement[];
  tiles: ISerializedHexTile[];
}

export default class HexMapModel implements IWorldMap {
  private _name = '';
  private _width = 0;
  private _height = 0;
  private _complexity: Complexity = Complexity.NORMAL;
  private _mapTilesConfig: IHexMapPlacement[] = [];
  private _tiles: HexTileModel[] = [];
  private _fogPolicy: TFogPolicy = 'FOG';

  // Lazily-built `coordinateKey -> tile` index. Every lookup in the engine
  // used to be a linear `tiles.find(...)`; the exploration slice does several
  // of those per hero step (route revalidation, patrol perception, world
  // pulse), which is quadratic on a real map. See `getTileAt` for the one
  // assumption this makes.
  private _tileIndex: Map<string, HexTileModel> | null = null;
  private _indexedTiles: HexTileModel[] | null = null;
  private _indexedLength = 0;

  set name(mapName: string) {
    this._name = mapName;
  }

  get name(): string {
    return this._name;
  }

  set width(mapWidth: number) {
    this._width = mapWidth;
  }

  get width(): number {
    return this._width;
  }

  set height(mapHeight: number) {
    this._height = mapHeight;
  }

  get height(): number {
    return this._height;
  }

  set config(mapTilesConfig: IHexMapPlacement[]) {
    this._mapTilesConfig = mapTilesConfig;
  }

  get config(): IHexMapPlacement[] {
    return this._mapTilesConfig;
  }

  set complexity(mapComplexity: Complexity) {
    this._complexity = mapComplexity;
  }

  get complexity(): Complexity {
    return this._complexity;
  }

  get tiles(): HexTileModel[] {
    return this._tiles;
  }

  set tiles(tiles: HexTileModel[]) {
    this._tiles = tiles;
    this.invalidateTileIndex();
  }

  /**
   * The tile at `coordinates`, or null when the map has none there.
   *
   * Assumes a tile's coordinates do not change once it is on the map — true
   * everywhere in the engine today (tiles get their coordinates in
   * `generateTiles`/`WorldGenerator.buildBaseGrid`/`fromJSON`, all before the
   * array is installed). Reassigning `tile.coordinates` afterwards is the one
   * case the index cannot see by itself: call `invalidateTileIndex()` if you
   * ever do that.
   *
   * Replacing the array or pushing onto it *is* detected, so callers that
   * grow the map keep working without knowing the index exists.
   */
  public getTileAt(coordinates: IHexCoordinates): HexTileModel | null {
    return this.tileIndex().get(coordinateKey(coordinates)) ?? null;
  }

  /** Drops the cached index; the next `getTileAt` rebuilds it. */
  public invalidateTileIndex(): void {
    this._tileIndex = null;
    this._indexedTiles = null;
    this._indexedLength = 0;
  }

  private tileIndex(): Map<string, HexTileModel> {
    if (
      this._tileIndex &&
      this._indexedTiles === this._tiles &&
      this._indexedLength === this._tiles.length
    ) {
      return this._tileIndex;
    }

    const index = new Map<string, HexTileModel>();
    // First tile wins on duplicate coordinates, matching the
    // `Array.prototype.find` semantics every call site had before the index.
    for (const tile of this._tiles) {
      const key = coordinateKey(tile.coordinates);
      if (!index.has(key)) index.set(key, tile);
    }

    this._tileIndex = index;
    this._indexedTiles = this._tiles;
    this._indexedLength = this._tiles.length;

    return index;
  }

  get fogPolicy(): TFogPolicy {
    return this._fogPolicy;
  }

  set fogPolicy(v: TFogPolicy) {
    this._fogPolicy = v;
  }

  public generateTiles(): void {
    this._tiles = [];
    this.invalidateTileIndex();

    for (let q = 0; q < this.width; q++) {
      for (let r = 0; r < this.height; r++) {
        const hex = new HexTileBuilder()
          .hexBackgroundImagePath(
            'src/a-game-scenes/map-scene/assets/hex-tile-terrain-images/empty-tile-image.png',
          )
          .coordinates({ columnIndex: q, rowIndex: r })
          .build();

        this._tiles.push(hex);
      }
    }

    this.invalidateTileIndex();

    if (!this.config.length) return;

    for (const tileConfig of this.config) {
      for (const c of tileConfig.coordinates) {
        const tile = this.getTileAt(c);

        if (!tile) {
          console.warn(
            `Missing tile with coordinates: [${c.columnIndex},${c.rowIndex}] for place ${tileConfig.hexobject?.hexobjectKey ?? 'unknown'}`,
          );
          continue;
        }

        tile.coordinates = { columnIndex: c.columnIndex, rowIndex: c.rowIndex };

        tile.hexBackgroundImagePath = tileConfig.initialTileImage?.length
          ? tileConfig.initialTileImage[
              Math.floor(Math.random() * tileConfig.initialTileImage.length)
            ]
          : '';
      }
    }
  }

  public toJSON() {
    return {
      name: this.name,
      width: this.width,
      height: this.height,
      complexity: this.complexity,
      config: this.config,
      fogPolicy: this.fogPolicy,
      tiles: this.tiles.map((t) => ({
        imagePath: t.hexBackgroundImagePath,
        tileKey: t.tileKey,
        coordinates: t.coordinates,
        // Both are written: `discovery` is the real value, `isRevealed` keeps
        // the payload readable by anything still on the boolean.
        isRevealed: t.isRevealed,
        discovery: t.discovery,
        hexobject: t.hexobject,
        resourceSpawner: t.resourceSpawner,
        pendingAction: t.pendingAction,
      })),
    };
  }

  public static fromJSON(raw: ISerializedHexMap, now: number): HexMapModel {
    const map = new HexMapModel();
    map.name = raw.name;
    map.width = raw.width;
    map.height = raw.height;
    map.complexity = raw.complexity;
    map.config = raw.config;

    map.tiles = raw.tiles.map((t) => {
      const tile = new HexTileModel();
      // A pre-E1 payload has only the boolean; `true` there meant exactly
      // what `DISCOVERED` means now, so the shim's own translation is the
      // right one and the fallback needs no special case.
      tile.isRevealed = t.isRevealed ?? false;
      if (t.discovery) tile.discovery = t.discovery;
      tile.hexBackgroundImagePath = t.imagePath ?? '';
      tile.coordinates = t.coordinates ?? { rowIndex: t.r ?? 0, columnIndex: t.q ?? 0 };

      const savedObj: THexobject | null = t.hexobject ?? null;
      tile.hexobject = savedObj ? this.hydrateHexobject(savedObj, tile.coordinates) : null;

      tile.resourceSpawner = t.resourceSpawner ?? null;
      tile.pendingAction = t.pendingAction ?? null;

      return tile;
    });

    // Reconcile after hydration: drop stale in-progress actions and spawn
    // resources whose respawn timer already elapsed while the map was unloaded.
    for (const tile of map.tiles) {
      const action = tile.pendingAction;
      if (action?.type === EHexActionType.USE) {
        tile.pendingAction = null;
      }

      const s = tile.resourceSpawner;
      if (
        !tile.hexobject &&
        s?.enabled &&
        typeof s.nextSpawnAt === 'number' &&
        now >= s.nextSpawnAt
      ) {
        tile.hexobject = HexObjectFactory.create(
          s.proto.hexobjectKey,
          tile.coordinates,
          s.proto.overrides,
        );
        s.nextSpawnAt = null;
      }
    }

    return map;
  }

  private static hydrateHexobject(saved: THexobject, coord: IHexCoordinates): THexobject {
    const overrides: Record<string, any> = {};

    if (saved.groupType === EHexobjectGroup.RESOURCE) {
      if (typeof saved.resource?.regrowMs === 'number')
        overrides.regrowMs = saved.resource.regrowMs;
      if (typeof saved.resource?.amount === 'number') overrides.amount = saved.resource.amount;
      if (typeof saved.resource?.isAvailable === 'boolean')
        overrides.isAvailable = saved.resource.isAvailable;
      if (typeof saved.resource?.regrowAt === 'number' || saved.resource?.regrowAt === null) {
        overrides.regrowAt = saved.resource.regrowAt;
      }
    }

    if (saved.groupType === EHexobjectGroup.TOOL) {
      if (typeof saved.tool?.durability === 'number') overrides.durability = saved.tool.durability;
      if (typeof saved.tool?.durabilityMax === 'number')
        overrides.durabilityMax = saved.tool.durabilityMax;
    }

    const built = HexObjectFactory.create(saved.hexobjectKey, coord, overrides);

    switch (saved.groupType) {
      case EHexobjectGroup.CREATURE: {
        if ('creature' in built && 'creature' in saved) {
          built.creature.hp = normalizeHealthValue(saved.creature.hp ?? built.creature.hp);
          built.creature.hpMax = normalizeHealthValue(
            saved.creature.hpMax ?? built.creature.hpMax,
            0.1,
          );
          built.creature.attack = saved.creature.attack ?? built.creature.attack;
          built.creature.faction = saved.creature.faction ?? built.creature.faction;
          built.creature.visionRange = saved.creature.visionRange ?? built.creature.visionRange;
        }
        break;
      }

      case EHexobjectGroup.CONSTRUCTION: {
        if ('construction' in built && 'construction' in saved) {
          built.construction.integrity =
            saved.construction.integrity ?? built.construction.integrity;
          built.construction.isLocked = saved.construction.isLocked ?? built.construction.isLocked;
        }
        break;
      }

      case EHexobjectGroup.EQUIPMENT: {
        if ('weapon' in built && 'weapon' in saved && built.weapon && saved.weapon) {
          built.weapon.damageMin = saved.weapon.damageMin ?? built.weapon.damageMin;
          built.weapon.damageMax = saved.weapon.damageMax ?? built.weapon.damageMax;
        }
        if ('equipment' in built && 'equipment' in saved) {
          built.equipment.durability = saved.equipment.durability ?? built.equipment.durability;
          built.equipment.durabilityMax =
            saved.equipment.durabilityMax ?? built.equipment.durabilityMax;
        }
        break;
      }

      case EHexobjectGroup.RESOURCE:
      case EHexobjectGroup.TOOL:
      default:
        break;
    }

    return built;
  }
}
