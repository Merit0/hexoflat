import {IHexMapConfig} from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import {Complexity} from "@/enums/complexity";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {HexTileBuilder} from "@/a-game-scenes/homeland-scene/builders/hex-tile-builder";

interface IWorldMap {
    name: string;
    width: number;
    height: number;
    complexity: Complexity;
    config: IHexMapConfig[];
    tiles: HexTileModel[];
}

export default class HexMapModel implements IWorldMap {
    private _name: string;
    private _width: number;
    private _height: number;
    private _complexity: Complexity;
    private _mapTilesConfig: IHexMapConfig[];
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

    set config(mapTilesConfig: IHexMapConfig[]) {
        this._mapTilesConfig = mapTilesConfig;
    }

    get config(): IHexMapConfig[] {
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
                    .imagePath("src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png")
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

        for (const place of this.config) {
            for (const c of place.coordinates) {
                const key = `${c.columnIndex}:${c.rowIndex}`;
                const tile = tileByCoordinate.get(key);
                tile.tileKey = place.key;
                tile.tileType = place.placeType;
                tile.description = place.description;
                tile.coordinates = {columnIndex: c.columnIndex, rowIndex: c.rowIndex};

                if (!tile) {
                    console.warn(
                        `Missing tile with coordinates: [${c.columnIndex},${c.rowIndex}] for place ${place.key}`
                    );
                    continue;
                }

                tile.imagePath =
                    place.images?.length
                        ? place.images[Math.floor(Math.random() * place.images.length)]
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
                imagePath: t.imagePath,
                tileKey: t.tileKey,
                tileType: t.tileType,
                description: t.description,
                coordinates: t.coordinates,
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
            tile.tileType = t.place ?? "empty";
            tile.imagePath = t.imagePath ?? "";
            tile.tileKey = t.tileKey ?? "";
            tile.tileType = t.tileType;
            tile.description = t.description ?? "";
            tile.coordinates = t.coordinates ?? {rowIndex: t.r, columnIndex: t.q};
            return tile;
        });

        return map;
    }
}