import {HexMapModel} from '@/a-game-scenes/silesia-world-scene/models/hex-map-model';
import {HexTileModel} from '@/a-game-scenes/silesia-world-scene/models/hex-tile-model';
import silesiaRegions from "@/a-game-scenes/silesia-world-scene/providers/region-provider";

export class HexMapProvider {
    static getSilesia(): HexMapModel {
        const map = new HexMapModel('silesia', 25, 11, silesiaRegions);

        this.generateTiles(map);
        this.applyRegionTerrain(map);

        return map;
    }

    private static generateTiles(map: HexMapModel): void {
        const tiles: HexTileModel[] = [];

        for (let q = 0; q < map.width; q++) {
            for (let r = 0; r < map.height; r++) {
                tiles.push(new HexTileModel(q, r));
            }
        }

        map.tiles = tiles;
    }

    private static applyRegionTerrain(map: HexMapModel): void {
        for (const region of map.regions) {
            for (const [q, r] of region.coordinates) {
                const tile = map.tiles.find(t => t.q === q && t.r === r);
                if (!tile) {
                    console.warn(`Missing tile [${q},${r}] for region ${region.key}`);
                    continue;
                }

                const imagePath = region.images
                    ? region.images[Math.floor(Math.random() * region.images.length)]
                    : '';

                tile.setTerrain(region.terrain, imagePath, region.key, region.name, region.requiredMyriads);
            }
        }
    }
}
