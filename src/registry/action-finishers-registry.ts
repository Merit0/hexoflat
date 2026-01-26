import { EHexActionType } from "@/enums/hex-action-type";
import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import type { IPendingTileAction } from "@/abstraction/hex-tile-abstraction";
import {IActionContext} from "@/abstraction/action-context";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";
import {useGatheringStore} from "@/stores/gathering-store";

export type ActionFinisher = (tile: HexTileModel, action: IPendingTileAction, ctx: IActionContext) => boolean;



export const ACTION_FINISHERS: Record<EHexActionType, ActionFinisher> = {
    [EHexActionType.CUT]: (tile: HexTileModel, action: IPendingTileAction, ctx: IActionContext) => {
    const gathering = useGatheringStore();

        if (action.cancelled) {
            (ctx.heroToolStore as any).unlockTool?.();
            return true;
        }

        gathering.add(action.hexobjectKey, 1);

        tile.hexobject = null;

        const meta = HEXOBJECT_META[action.hexobjectKey];
        const wood = meta?.yields?.wood ?? 0;

        if (wood > 0 && ctx.heroToolStore.addTreeCut) {
            ctx.heroToolStore.addTreeCut(wood);
        }

        if (tile.resourceSpawner?.enabled) {
            tile.resourceSpawner.nextSpawnAt = ctx.now + tile.resourceSpawner.regrowMs;
        }

        if (ctx.heroToolStore.isLocked) {
            (ctx.heroToolStore as any).unlockTool?.();
        }

        return true;
    },

    [EHexActionType.MINE]: (_tile, _action, ctx) => {
        if ((ctx.heroToolStore as any).isLocked) (ctx.heroToolStore as any).unlockTool?.();
        return true;
    },

    [EHexActionType.TAKE]: (tile, action, ctx) => {
        const gathering = useGatheringStore();
        if (action.cancelled) {
            if (ctx.heroToolStore.isLocked) (ctx.heroToolStore as any).unlockTool?.();
            return true;
        }

        // беремо amount з об'єкта прямо перед видаленням
        const amount =
            tile.hexobject?.groupType === "resource"
                ? (tile.hexobject.resource.amount ?? 1)
                : 1;

        const meta = HEXOBJECT_META[action.hexobjectKey];
        const baseCoins = meta?.yields?.coins ?? 0;

        if (baseCoins > 0) {
            gathering.add(action.hexobjectKey, baseCoins * amount);
        } else {
            gathering.add(action.hexobjectKey, amount);
        }

        tile.hexobject = null;

        // if resource has spawner for TAKE action
        if (tile.resourceSpawner?.enabled) {
            tile.resourceSpawner.nextSpawnAt = ctx.now + tile.resourceSpawner.regrowMs;
        }

        if (ctx.heroToolStore.isLocked) (ctx.heroToolStore as any).unlockTool?.();
        return true;
    },

    [EHexActionType.OPEN]: (_tile, _action, ctx) => {
        if ((ctx.heroToolStore as any).isLocked) (ctx.heroToolStore as any).unlockTool?.();
        return true;
    },

    [EHexActionType.ATTACK]: (_tile, _action, ctx) => {
        if ((ctx.heroToolStore as any).isLocked) (ctx.heroToolStore as any).unlockTool?.();
        return true;
    },
};