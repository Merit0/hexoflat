import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import { EHexActionType } from "@/enums/hex-action-type";
import {ACTION_STARTERS} from "@/registry/action-starters-registry";
import { THeroToolKey } from "@/registry/hexobjects/prototypes/equipment.prototypes";

export class ExecuteHexActionFeature {
    private readonly tile: HexTileModel;

    constructor(tile: HexTileModel) {
        this.tile = tile;
    }

    public execute(actionType: EHexActionType, tool: THeroToolKey, now = Date.now()) {
        const starter = ACTION_STARTERS[actionType];
        if (!starter) return { ok: false, message: `No starters for Action -> [ ${actionType} ]` };

        return starter(this.tile, tool, now);
    }
}
