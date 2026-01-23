import type {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {HeroToolType} from "@/enums/hero-tool-type";
import {EHexActionType} from "@/enums/hex-action-type";
import {EHexobjectGroup} from "@/abstraction/hexobject-abstraction";
import {getToolCapabilities, ResolvedActionType} from "@/game-resolvers/interactions-resolver";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";
import {useHeroToolStore} from "@/stores/hero-tool-store";

export type StartResult =
    | { ok: true; endsAt: number }
    | { ok: false; message: string };

export type ActionStarter = (tile: HexTileModel, tool: HeroToolType, now: number) => StartResult;

function isBusy(tile: HexTileModel, now: number): boolean {
    const action = tile.pendingAction;
    if (!action) return false;

    if (action.cancelled) {
        tile.pendingAction = null;
        return false;
    }

    if (now < action.endsAt) return true;

    tile.pendingAction = null;
    return false;
}

export const ACTION_TYPE_MAP: Record<ResolvedActionType, EHexActionType> = {
    CUT: EHexActionType.CUT,
    MINE: EHexActionType.MINE,
    TAKE: EHexActionType.TAKE,
    OPEN: EHexActionType.OPEN,
    ATTACK: EHexActionType.ATTACK,
};

export const ACTION_STARTERS: Record<EHexActionType, ActionStarter> = {
    [EHexActionType.CUT]: (tile, tool, now) => {
        const obj = tile.hexobject;
        if (!obj) return { ok: false, message: "Hex has no object!" };

        const a = tile.pendingAction;
        if (a) {
            if (now < a.endsAt) return { ok: false, message: "Tile is busy!" };

            tile.pendingAction = null;
        }

        if (obj.groupType !== EHexobjectGroup.RESOURCE) {
            return { ok: false, message: "It is not resource!" };
        }
        if (!obj.resource?.traits?.cuttable) {
            return { ok: false, message: "This resource is not cuttable!" };
        }

        const meta = HEXOBJECT_META[obj.hexobjectKey];
        const cutCfg = meta?.actions?.[EHexActionType.CUT];

        const requiredTool: HeroToolType = cutCfg?.requiredTool ?? HeroToolType.AXE;
        const durationMs: number = cutCfg?.durationMs ?? 5000;
        const costPct: number = cutCfg?.durabilityCostPct ?? 0.1;

        if (requiredTool && tool !== requiredTool) {
            return { ok: false, message: `Need a tool: ${requiredTool}` };
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canCut) return { ok: false, message: "Need something to cut with!" };

        const heroToolStore = useHeroToolStore();
        const okDur = heroToolStore.consumeDurability(costPct);
        if (!okDur) {
            heroToolStore.activeTool = HeroToolType.HAND;
            return { ok: false, message: "Tool is broken!" };
        }

        const endsAt = now + durationMs;

        tile.pendingAction = {
            type: EHexActionType.CUT,
            startedAt: now,
            endsAt,
            hexobjectKey: obj.hexobjectKey,
            cancelled: false,
        };

        if ((heroToolStore as any).lockTool) {
            (heroToolStore as any).lockTool(tile, endsAt);
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