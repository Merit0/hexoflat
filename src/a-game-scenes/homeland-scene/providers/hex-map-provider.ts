import HexMapModel from '@/a-game-scenes/homeland-scene/models/hex-map-model';
import { homelandMapConfig } from '@/a-game-scenes/homeland-scene/providers/map-tiles-schema-provider';
import {HexMapBuilder} from "@/a-game-scenes/homeland-scene/builders/hex-map-builder";
import {Complexity} from "@/enums/complexity";

export class HexMapProvider {

    static getHomeLand(): HexMapModel {
        return new HexMapBuilder()
            .name('homeland')
            .width(27)
            .height(11)
            .complexity(Complexity.EASY)
            .config(homelandMapConfig)
            .build();
    }

    // private static generateTiles(map: HexMapModel): void {
    //     const tiles: HexTileModel[] = [];
    //
    //     for (let q = 0; q < map.width; q++) {
    //         for (let r = 0; r < map.height; r++) {
    //             const hex = new HexTileBuilder().coordinates({columnIndex: q, rowIndex: r}).build();
    //             tiles.push(hex);
    //         }
    //     }
    //
    //     map.tiles = tiles;
    // }
}
