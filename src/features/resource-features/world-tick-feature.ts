import type HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import {FinishPendingActionsFeature} from "@/features/resource-features/finish-pending-actions-feature";
import {SpawnResourceFeature} from "@/features/resource-features/spawn-resource-feature";

export class WorldTickFeature {
    private readonly map: HexMapModel;

    constructor(map: HexMapModel) {
        this.map = map;
    }

    /**
     * Returns true if world state changed and should be saved.
     */
    public tick(now = Date.now()): boolean {
        let changed = false;

        changed = new FinishPendingActionsFeature(this.map).finish(now) || changed;
        changed = new SpawnResourceFeature(this.map).spawn(now) || changed;

        return changed;
    }
}