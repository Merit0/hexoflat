import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import type { HeroToolType } from "@/enums/hero-tool-type";
import { EHexActionType } from "@/enums/hex-action-type";
import {ACTION_STARTERS} from "@/registry/action-starters-registry";

export class ExecuteHexActionFeature {
    private readonly tile: HexTileModel;

    constructor(tile: HexTileModel) {
        this.tile = tile;
    }

    public execute(actionType: EHexActionType, tool: HeroToolType, now = Date.now()) {
        const starter = ACTION_STARTERS[actionType];
        if (!starter) return { ok: false, message: `No starters for Action -> [ ${actionType} ]` };

        return starter(this.tile, tool, now);
    }
}