import type { HexTileModel } from "@/a-game-scenes/homeland-scene/models/hex-tile-model";
import type { HeroToolType } from "@/enums/hero-tool-type";
import { EHexActionType } from "@/enums/hex-action-type";
import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";
import { getToolCapabilities } from "@/game-resolvers/interactions-resolver";
import { useHeroToolStore } from "@/stores/hero-tool-store";
import type { ResolvedActionType } from "@/game-resolvers/interactions-resolver";

export type StartResult =
    | { ok: true; endsAt: number }
    | { ok: false; message: string };

export type ActionStarter = (tile: HexTileModel, tool: HeroToolType, now: number) => StartResult;

function isBusy(tile: HexTileModel, now: number): boolean {
    const a = tile.pendingAction;
    if (!a) return false;
    if (now < a.endsAt) return true;
    tile.pendingAction = null;
    return false;
}

export const ACTION_TYPE_MAP: Record<ResolvedActionType, EHexActionType> = {
    CUT: EHexActionType.CUT,
    MINE: EHexActionType.MINE,
    PICKUP: EHexActionType.TAKE,
    OPEN: EHexActionType.OPEN,
    ATTACK: EHexActionType.ATTACK,
};

export const ACTION_STARTERS: Record<EHexActionType, ActionStarter> = {
    [EHexActionType.CUT]: (tile, tool, now) => {
        const obj = tile.hexobject;
        if (!obj) return { ok: false, message: "Hex has no object!" };

        if (isBusy(tile, now)) return { ok: false, message: "Tile is busy!" };

        if (obj.groupType !== EHexobjectGroup.RESOURCE) {
            return { ok: false, message: "It is not resource!" };
        }
        if (!obj.resource?.traits?.cuttable) {
            return { ok: false, message: "This resource is not cuttable!" };
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canCut) return { ok: false, message: "Need something to cut with!" };

        const heroToolStore = useHeroToolStore();
        const okDur = heroToolStore.consumeDurability(0.1);
        if (!okDur) {
            heroToolStore.activeTool = "hand" as HeroToolType;
            return { ok: false, message: "Tool is broken!" };
        }

        const endsAt = now + 5000;

        tile.pendingAction = {
            type: EHexActionType.CUT,
            startedAt: now,
            endsAt,
            hexobjectKey: obj.hexobjectKey,
        };

        if ((heroToolStore as any).lockTool) {
            (heroToolStore as any).lockTool(tile.coordinates, endsAt);
        }

        return { ok: true, endsAt };
    },

    [EHexActionType.MINE]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return { ok: false, message: "Hex is busy!" };
        return { ok: false, message: "MINE is not implemented yet!" };
    },

    [EHexActionType.TAKE]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return { ok: false, message: "Hex is busy!" };
        return { ok: false, message: "TAKE is not implemented yet!" };
    },

    [EHexActionType.OPEN]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return { ok: false, message: "Hex is busy!" };
        return { ok: false, message: "OPEN is not implemented yet!" };
    },

    [EHexActionType.ATTACK]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return { ok: false, message: "Hex is busy!" };
        return { ok: false, message: "ATTACK is not implemented yet!" };
    },
};