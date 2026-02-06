import { Complexity } from "@/enums/complexity";
import {IHexMapPlacement} from "@/abstraction/hex-map-placement";

export interface IWorldGenerator {
    worldName: string;
    worldWidth: number;
    worldHeight: number;
    worldComplexity: Complexity;
    config: IHexMapPlacement[];
    safeZoneRadius?: number;
}