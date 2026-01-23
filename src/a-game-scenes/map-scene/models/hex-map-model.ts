import {Complexity} from "@/enums/complexity";
import {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {HexTileBuilder} from "@/a-game-scenes/map-scene/builders/hex-tile-builder";
import {IHexMapPlacement} from "@/abstraction/hex-map-placement";
import {HexTileType, IHexCoordinates} from "@/a-game-scenes/map-scene/interfaces/hex-tile-config-interface";
import {EHexobjectGroup, THexobject} from "@/abstraction/hexobject-abstraction";
import {HexObjectFactory} from "@/factory/hex-object-factory";

interface IWorldMap {
    name: string;
    width: number;
    height: number;
    complexity: Complexity;
    config: IHexMapPlacement[];
    tiles: HexTileModel[];
}

export default class HexMapModel implements IWorldMap {
    private _name: string;
    private _width: number;
    private _height: number;
    private _complexity: Complexity;
    private _mapTilesConfig: IHexMapPlacement[];
    private _tiles: HexTileModel[] = [];

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

    public generateTiles(): void {
        console.log('Generating tiles...');
        this._tiles = [];

        for (let q = 0; q < this.width; q++) {
            for (let r = 0; r < this.height; r++) {
                const hex = new HexTileBuilder()
                    .hexBackgroundImagePath("src/a-game-scenes/map-scene/assets/hex-tile-terrain-images/empty-tile-image.png")
                    .coordinates({columnIndex: q, rowIndex: r})
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
                tile.tileKey = tileConfig.rootPathKey;
                tile.coordinates = {columnIndex: c.columnIndex, rowIndex: c.rowIndex};

                if (!tile) {
                    console.warn(
                        `Missing tile with coordinates: [${c.columnIndex},${c.rowIndex}] for place ${tileConfig.hexobject.hexobjectKey}`
                    );
                    continue;
                }

                tile.hexBackgroundImagePath =
                    tileConfig.initialTileImage?.length
                        ? tileConfig.initialTileImage[Math.floor(Math.random() * tileConfig.initialTileImage.length)]
                        : "";
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
            tiles: this.tiles.map(t => ({
                imagePath: t.hexBackgroundImagePath,
                tileKey: t.tileKey,
                tileType: t.tileType,
                coordinates: t.coordinates,
                isRevealed: t.isRevealed,
                hexobject: t.hexobject,
                resourceSpawner: t.resourceSpawner,
                pendingAction: t.pendingAction,
            })),
        };
    }

    public static fromJSON(raw: any): HexMapModel {
        const map = new HexMapModel();
        map.name = raw.name;
        map.width = raw.width;
        map.height = raw.height;
        map.complexity = raw.complexity;
        map.config = raw.config;

        map.tiles = raw.tiles.map((t: any) => {
            const tile = new HexTileModel();
            tile.tileType = (t.tileType as HexTileType) ?? "empty";
            tile.isRevealed = t.isRevealed ?? false;
            tile.hexBackgroundImagePath = t.imagePath ?? "";
            tile.tileKey = t.tileKey ?? null;
            tile.coordinates = t.coordinates ?? {rowIndex: t.r, columnIndex: t.q};

            const savedObj: THexobject | null = t.hexobject ?? null;
            tile.hexobject = savedObj ? this.hydrateHexobject(savedObj, tile.coordinates) : null;

            tile.resourceSpawner = t.resourceSpawner ?? null;
            tile.pendingAction = t.pendingAction ?? null;

            return tile;
        });

        // ✅ Reconcile after hydration
        const now = Date.now();
        let changed = false;

        for (const tile of map.tiles) {
            // 1) Finish expired pending actions immediately
            const a = tile.pendingAction;
            if (a && now >= a.endsAt) {
                if (a.type === "CUT") {
                    if (tile.hexobject !== null) {
                        tile.hexobject = null;
                        changed = true;
                    }

                    if (tile.resourceSpawner?.enabled) {
                        tile.resourceSpawner.nextSpawnAt = now + tile.resourceSpawner.regrowMs;
                        changed = true;
                    }
                }

                tile.pendingAction = null;
                changed = true;
            }

            // 2) Optional: spawn immediately if respawn time already passed
            const s = tile.resourceSpawner;
            if (!tile.hexobject && s?.enabled && typeof s.nextSpawnAt === "number" && now >= s.nextSpawnAt) {
                tile.hexobject = HexObjectFactory.create(
                    s.proto.hexobjectKey,
                    tile.coordinates,
                    s.proto.overrides
                );
                s.nextSpawnAt = null;
                changed = true;
            }
        }

        // ✅ mark map as dirty so caller can save once
        (map as any).__rehydrateChanged = changed;

        return map;
    }

    private static hydrateHexobject(saved: THexobject, coord: IHexCoordinates): THexobject {
        const overrides: Record<string, any> = {};

        if (saved.groupType === EHexobjectGroup.RESOURCE) {
            if (typeof saved.resource?.regrowMs === "number") overrides.regrowMs = saved.resource.regrowMs;
            if (typeof saved.resource?.amount === "number") overrides.amount = saved.resource.amount;
            if (typeof saved.resource?.isAvailable === "boolean") overrides.isAvailable = saved.resource.isAvailable;
            if (typeof saved.resource?.regrowAt === "number" || saved.resource?.regrowAt === null) {
                overrides.regrowAt = saved.resource.regrowAt;
            }
        }

        if (saved.groupType === EHexobjectGroup.TOOL) {
            if (typeof saved.tool?.durability === "number") overrides.durability = saved.tool.durability;
            if (typeof saved.tool?.durabilityMax === "number") overrides.durabilityMax = saved.tool.durabilityMax;
        }

        const built = HexObjectFactory.create(saved.hexobjectKey, coord, overrides);

        switch (saved.groupType) {
            case EHexobjectGroup.CREATURE: {
                if ("creature" in built && "creature" in saved) {
                    built.creature.hp = saved.creature.hp ?? built.creature.hp;
                    built.creature.hpMax = saved.creature.hpMax ?? built.creature.hpMax;
                    built.creature.faction = saved.creature.faction ?? built.creature.faction;
                }
                break;
            }

            case EHexobjectGroup.CONSTRUCTION: {
                if ("construction" in built && "construction" in saved) {
                    built.construction.integrity = saved.construction.integrity ?? built.construction.integrity;
                }
                break;
            }

            case EHexobjectGroup.WEAPON: {
                if ("weapon" in built && "weapon" in saved) {
                    built.weapon.damageMin = saved.weapon.damageMin ?? built.weapon.damageMin;
                    built.weapon.damageMax = saved.weapon.damageMax ?? built.weapon.damageMax;
                }
                if ("equipment" in built && "equipment" in saved) {
                    built.equipment.durability = saved.equipment.durability ?? built.equipment.durability;
                    built.equipment.durabilityMax = saved.equipment.durabilityMax ?? built.equipment.durabilityMax;
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