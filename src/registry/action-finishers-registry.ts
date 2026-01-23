import { EHexActionType } from "@/enums/hex-action-type";
import type { HexTileModel } from "@/a-game-scenes/map-scene/models/hex-tile-model";
import type { IPendingTileAction } from "@/abstraction/hex-tile-abstraction";
import {IActionContext} from "@/abstraction/action-context";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";

export type ActionFinisher = (tile: HexTileModel, action: IPendingTileAction, ctx: IActionContext) => boolean;

export const ACTION_FINISHERS: Record<EHexActionType, ActionFinisher> = {
    [EHexActionType.CUT]: (tile: HexTileModel, action: IPendingTileAction, ctx: IActionContext) => {

        if (action.cancelled) {
            (ctx.heroToolStore as any).unlockTool?.();
            return true;
        }

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