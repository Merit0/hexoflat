import HexMapModel from '@/a-game-scenes/map-scene/models/hex-map-model';
import {campingMapConfig, homelandMapConfig} from '@/a-game-scenes/map-scene/providers/map-tiles-schema-provider';
import {Complexity} from "@/enums/complexity";
import {WorldGenerator} from "@/generators/world-generator";

export class HexMapProvider {
    static getHomeLand(): HexMapModel {
        return new WorldGenerator({
            worldName: "Silesia",
            worldWidth: 27,
            worldHeight: 11,
            worldComplexity: Complexity.EASY,
            config: homelandMapConfig,
            treeChance: 0.10,
            safeZoneRadius: 1,
        }).generate();
    }

    static getCamping(): HexMapModel {
        return new WorldGenerator({
            worldName: "Camping",
            worldWidth: 10,
            worldHeight: 6,
            worldComplexity: Complexity.EASY,
            config: campingMapConfig,
            treeChance: 0.10,
            safeZoneRadius: 1,
        }).generate();
    }
}