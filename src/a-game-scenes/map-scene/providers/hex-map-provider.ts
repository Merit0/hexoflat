import HexMapModel from '@/a-game-scenes/map-scene/models/hex-map-model';
import { homelandMapConfig } from '@/a-game-scenes/map-scene/providers/map-tiles-schema-provider';
import {Complexity} from "@/enums/complexity";
import {WorldGenerator} from "@/utils/world-generator";

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
}