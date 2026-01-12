import type HexMapModel from "@/a-game-scenes/homeland-scene/models/hex-map-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import {IPendingTileAction} from "@/abstraction/hex-tile-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";

export class FinishPendingActionsFeature {
    private readonly map: HexMapModel;

    constructor(map: HexMapModel) {
        this.map = map;
    }

    public finish(now = Date.now()): boolean {
        const heroToolStore = useHeroToolStore();
        let changed = false;

        for (const tile of this.map.tiles) {
            const hexPendingAction: IPendingTileAction = tile.pendingAction;
            if (!hexPendingAction) continue;

            // if action is not finished yet -> nothing
            if (now < hexPendingAction.endsAt) continue;

            //action is finished -> do finalizing it
            switch (hexPendingAction.type) {
                case EHexActionType.CUT: {
                    tile.hexobject = null;

                    if (hexPendingAction.hexobjectKey === "tree") { //todo: TREE should be registered
                        heroToolStore.addTreeCut(1);
                    }

                    // setup resource respawn if added from config
                    if (tile.resourceSpawner?.enabled) {
                        tile.resourceSpawner.nextSpawnAt = now + tile.resourceSpawner.regrowMs;
                    }

                    if (heroToolStore.isLocked) {
                        heroToolStore.unlockTool();
                    }

                    changed = true;
                    break;
                }

                case EHexActionType.MINE:
                case EHexActionType.TAKE:
                case EHexActionType.OPEN:
                case EHexActionType.ATTACK: {
                    if (heroToolStore.isLocked) {
                        heroToolStore.unlockTool();
                    }
                    changed = true;
                    break;
                }

                default: {
                    changed = true;
                    break;
                }
            }

            tile.pendingAction = null;
            changed = true;
        }

        return changed;
    }
}