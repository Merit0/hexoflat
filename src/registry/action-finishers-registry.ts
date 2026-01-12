import { EHexActionType } from "@/enums/hex-action-type";
import type { HexTileModel } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import type { IPendingTileAction } from "@/abstraction/hex-tile-abstraction";
import {IActionContext} from "@/abstraction/action-context";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

export type ActionFinisher = (tile: HexTileModel, action: IPendingTileAction, ctx: IActionContext) => boolean;

export const ACTION_FINISHERS: Record<EHexActionType, ActionFinisher> = {
    [EHexActionType.CUT]: (tile, action, ctx) => {
        tile.hexobject = null;

        if (action.hexobjectKey === HEXOBJECT_KEYS.TREE) {
            ctx.heroToolStore.addTreeCut(1);
        }

        if (tile.resourceSpawner?.enabled) {
            tile.resourceSpawner.nextSpawnAt = ctx.now + tile.resourceSpawner.regrowMs;
        }

        if ((ctx.heroToolStore as any).isLocked) {
            (ctx.heroToolStore as any).unlockTool?.();
        }

        return true;
    },

    [EHexActionType.MINE]: (_tile, _action, ctx) => {
        if ((ctx.heroToolStore as any).isLocked) (ctx.heroToolStore as any).unlockTool?.();
        return true;
    },

    [EHexActionType.TAKE]: (_tile, _action, ctx) => {
        if ((ctx.heroToolStore as any).isLocked) (ctx.heroToolStore as any).unlockTool?.();
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