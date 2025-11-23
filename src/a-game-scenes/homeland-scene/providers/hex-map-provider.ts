import {HexMapModel} from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import {HexTileModel} from '@/a-game-scenes/homeland-scene/models/hex-tile-model';
import forestLocation from "@/a-game-scenes/homeland-scene/providers/region-provider";

export class HexMapProvider {
    // static getSilesia(): HexMapModel {
    //     const map = new HexMapModel('silesia', 27, 11, forestLocation);
    //
    //     this.generateTiles(map);
    //     this.applyRegionTerrain(map);
    //
    //     return map;
    // }

    static getHomeLand(): HexMapModel {
        const map = new HexMapModel('homeland', 27, 11, forestLocation);

        this.generateTiles(map);
        this.buildMap(map);

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

    private static buildMap(map: HexMapModel): void {
        for (const place of map.places) {
            for (const coordinates of place.coordinates) {
                const tile = map.tiles.find(t => t.q === coordinates.columnIndex && t.r === coordinates.rowIndex);
                if (!tile) {
                    console.warn(`Missing tile with coordinates: [${coordinates.columnIndex},${coordinates.rowIndex}] for place ${place.key}`);
                    continue;
                }

                const imagePath = place.images
                    ? place.images[Math.floor(Math.random() * place.images.length)]
                    : '';

                tile.setupPlace(place.place, imagePath, place.key, place.name);
            }
        }
    }
}
