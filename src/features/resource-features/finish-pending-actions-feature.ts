import type HexMapModel from "@/a-game-scenes/map-scene/models/hex-map-model";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import {IActionContext} from "@/abstraction/action-context";
import {ACTION_FINISHERS} from "@/registry/action-finishers-registry";

export class FinishPendingActionsFeature {
    private readonly map: HexMapModel;

    constructor(map: HexMapModel) {
        this.map = map;
    }

    public finish(now = Date.now()): boolean {
        const heroToolStore = useHeroToolStore();

        const ctx: IActionContext = {
            map: this.map,
            now,
            heroToolStore,
        };

        let changed = false;

        for (const tile of this.map.tiles) {
            const action = tile.pendingAction;
            if (!action) continue;

            // ще триває
            if (now < action.endsAt) continue;

            const finisher = ACTION_FINISHERS[action.type];
            if (finisher) {
                changed = finisher(tile, action, ctx) || changed;
            } else {
                // якщо раптом немає фінішера — хоча б не залишати тайл “busy”
                changed = true;
            }

            // ✅ завжди очищаємо pendingAction
            tile.pendingAction = null;
            changed = true;
        }

        return changed;
    }
}