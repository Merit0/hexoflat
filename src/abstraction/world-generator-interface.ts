import { Complexity } from "@/enums/complexity";
import {IHexMapPlacement} from "@/abstraction/hex-map-placement";
import {LocationKey} from "@/registry/world-map-registry";

export interface IWorldGenerator {
    worldName: string;
    worldWidth: number;
    worldHeight: number;
    worldComplexity: Complexity;
    config: IHexMapPlacement[];
    locationKey: LocationKey;

    treeChance: number;
    safeZoneRadius: number;
}