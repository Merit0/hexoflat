import HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import { HexTileBuilder } from "@/a-game-scenes/homeland-scene/builders/hex-tile-builder";
import {HexTileModel} from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import {IWorldGenerator} from "@/abstraction/world-generator-interface";
import {coordinateKey, getOddQNeighbors} from "@/utils/hex-utils";
import {HexObjectFactory} from "@/factory/hex-object-factory";

export class WorldGenerator {
    constructor(private readonly generator: IWorldGenerator) {}

    generate(): HexMapModel {
        const map = new HexMapModel();
        map.name = this.generator.worldName;
        map.width = this.generator.worldWidth;
        map.height = this.generator.worldHeight;
        map.complexity = this.generator.worldComplexity;
        map.config = this.generator.config;

        // 1) базова сітка: всі empty + isRevealed=false
        map.tiles = this.buildBaseGrid();

        // 2) накладаємо конфіг: home/enemy/rock...
        this.applyConfig(map);

        // 3) safe-zone навколо home: 6 сусідів = empty
        this.applySafeZone(map);

        return map;
    }

    private buildBaseGrid() {
        const tiles = [];
        for (let q = 0; q < this.generator.worldWidth; q++) {
            for (let r = 0; r < this.generator.worldHeight; r++) {
                const hex: HexTileModel = new HexTileBuilder()
                    .type("empty")
                    .isRevealed(false)
                    .hexBackgroundImagePath("src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png")
                    .coordinates({ columnIndex: q, rowIndex: r })
                    .build();

                tiles.push(hex);
            }
        }
        return tiles;
    }

    private applyConfig(map: HexMapModel) {
        if (!map.config?.length) return;

        const byKey = new Map<string, any>();
        for (const t of map.tiles) byKey.set(coordinateKey(t.coordinates), t);

        for (const place of map.config) {
            for (const c of place.coordinates) {
                const tile = byKey.get(coordinateKey(c));
                if (!tile) continue;

                tile.tileKey = place.rootPathKey ?? null;
                if (place.hexobject) {
                    const kind = (place.hexobject.hexobjectKey ?? "tree");

                    tile.hexobject = HexObjectFactory.create(kind, tile.coordinates);
                    console.log(`Created ${kind} at ${tile.coordinates}`);
                } else {
                    tile.hexobject = null;
                }
            }
        }
    }

    private applySafeZone(map: HexMapModel) {
        const campingHexobjectKey = 'camping';
        const camping = map.tiles.find(t => t.hexobject?.hexobjectKey === campingHexobjectKey);
        if (!camping) return;

        const byKey = new Map<string, any>();
        for (const t of map.tiles) byKey.set(coordinateKey(t.coordinates), t);

        const neighbors = getOddQNeighbors(camping.coordinates);

        for (const c of neighbors) {
            const tile = byKey.get(coordinateKey(c));
            if (!tile) continue;
            if (tile.tileType === campingHexobjectKey) continue;

            tile.tileType = "empty";
            tile.tileKey = null;
            tile.description = "Nothing around";
            tile.imagePath = "src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/empty-tile-image.png";
        }
    }
}
