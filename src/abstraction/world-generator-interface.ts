import type { IHexMapConfig } from "@/a-game-scenes/homeland-scene/interfaces/hex-tile-config-interface";
import { Complexity } from "@/enums/complexity";

export interface IWorldGenerator {
    worldName: string;
    worldWidth: number;
    worldHeight: number;
    worldComplexity: Complexity;
    config: IHexMapConfig[];

    treeChance: number;      // 0.10
    safeZoneRadius: number;  // 1 (поки що)
}
