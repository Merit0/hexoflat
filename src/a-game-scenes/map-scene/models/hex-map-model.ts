import { Complexity } from '@/enums/complexity';
import { HexTileModel } from '@/a-game-scenes/map-scene/models/hex-tile-model';
import { HexTileBuilder } from '@/a-game-scenes/map-scene/builders/hex-tile-builder';
import { IHexMapPlacement } from '@/abstraction/hex-map-placement';
import { IHexCoordinates } from '@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface';
import { EHexobjectGroup, THexobject } from '@/abstraction/hexobject-abstraction';
import { HexObjectFactory } from '@/factory/hex-object-factory';
import { normalizeHealthValue } from '@/utils/combat/health-format';
import type { RouteName } from '@/router/routes';
import type { IHexResourceSpawner } from '@/abstraction/hex-resource-spawner';
import type { IPendingTileAction } from '@/abstraction/hex-tile-abstraction';
import { EHexActionType } from '@/enums/hex-action-type';

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
  }

  get fogPolicy(): TFogPolicy {
    return this._fogPolicy;
  }

  set fogPolicy(v: TFogPolicy) {
    this._fogPolicy = v;
  }

  public generateTiles(): void {
    console.log('Generating tiles...');
    this._tiles = [];

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

    if (!this.config.length) return;

    const tileByCoordinate = new Map<string, HexTileModel>();
    for (const t of this._tiles) {
      tileByCoordinate.set(`${t.coordinates.columnIndex}:${t.coordinates.rowIndex}`, t);
    }

    for (const tileConfig of this.config) {
      for (const c of tileConfig.coordinates) {
        const key = `${c.columnIndex}:${c.rowIndex}`;
        const tile = tileByCoordinate.get(key);

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
        isRevealed: t.isRevealed,
        hexobject: t.hexobject,
        resourceSpawner: t.resourceSpawner,
        pendingAction: t.pendingAction,
      })),
    };
  }

  public static fromJSON(raw: ISerializedHexMap): HexMapModel {
    const map = new HexMapModel();
    map.name = raw.name;
    map.width = raw.width;
    map.height = raw.height;
    map.complexity = raw.complexity;
    map.config = raw.config;

    map.tiles = raw.tiles.map((t) => {
      const tile = new HexTileModel();
      tile.isRevealed = t.isRevealed ?? false;
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
    const now = Date.now();

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
