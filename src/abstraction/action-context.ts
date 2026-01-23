import type HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";

export interface IActionContext {
    map: HexMapModel;
    now: number;
    heroToolStore: ReturnType<typeof useHeroToolStore>;
}