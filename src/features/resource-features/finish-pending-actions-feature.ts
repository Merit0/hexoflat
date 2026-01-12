import type HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";

export class FinishPendingActionsFeature {
    private readonly map: HexMapModel;

    constructor(map: HexMapModel) {
        this.map = map;
    }

    public finish(now = Date.now()): boolean {
        const heroToolStore = useHeroToolStore();
        let changed = false;

        for (const tile of this.map.tiles) {
            const a = tile.pendingAction;
            if (!a) continue;
            if (now < a.endsAt) continue;

            if (a.type === "CUT") {
                tile.hexobject = null;

                if (a.hexobjectKey === "tree") {
                    heroToolStore.addTreeCut(1);
                }

                if (tile.resourceSpawner?.enabled) {
                    tile.resourceSpawner.nextSpawnAt = now + tile.resourceSpawner.regrowMs;
                }

                changed = true;
            }

            tile.pendingAction = null;
            changed = true;
        }

        return changed;
    }
}