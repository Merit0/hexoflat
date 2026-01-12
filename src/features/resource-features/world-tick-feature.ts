import type HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
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

        // 1) finish actions (CUT end -> remove object, schedule respawn, counters)
        const finish = new FinishPendingActionsFeature(this.map);
        const finishChanged = finish.finish(now); // ✅ зробимо щоб він повертав boolean
        changed = changed || finishChanged;

        // 2) spawn resources (respawn when time)
        const spawner = new SpawnResourceFeature(this.map);
        const spawnChanged = spawner.spawn(now); // ✅ теж boolean
        changed = changed || spawnChanged;

        return changed;
    }
}