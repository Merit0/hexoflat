import type {HexTileModel} from "@/a-game-scenes/map-scene/models/hex-tile-model";
import {EHexActionType} from "@/enums/hex-action-type";
import {EHexobjectGroup, IResourceTraits} from "@/abstraction/hexobject-abstraction";
import {getToolCapabilities, ResolvedActionType} from "@/game-resolvers/interactions-resolver";
import {HEXOBJECT_META} from "@/registry/hexobject-meta";
import {useHeroToolStore} from "@/stores/hero-tool-store";
import {useWorldMapStore} from "@/stores/world-map-store";
import router, {ROUTES} from "@/router";
import {useGameEventsStore} from "@/stores/game-events-store";
import {useHeroStore} from "@/stores/hero-store";
import {TToolKeys} from "@/registry/hexobjects/prototypes/tools.prototypes";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

export type StartResult =
    | { ok: true; endsAt: number }
    | { ok: false; message: string };

export type ActionStarter = (tile: HexTileModel, tool: TToolKeys, now: number) => StartResult;

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
    USE: EHexActionType.USE,
    OPEN: EHexActionType.OPEN,
    ATTACK: EHexActionType.ATTACK,
    ENTER: EHexActionType.ENTER,
};

export const ACTION_STARTERS: Record<EHexActionType, ActionStarter> = {
    [EHexActionType.CUT]: (tile, tool, now) => {
        const obj = tile.hexobject;
        if (!obj) return {ok: false, message: "Hex has no object!"};

        const a = tile.pendingAction;
        if (a) {
            if (now < a.endsAt) return {ok: false, message: "Tile is busy!"};

            tile.pendingAction = null;
        }

        if (obj.groupType !== EHexobjectGroup.RESOURCE) {
            return {ok: false, message: "It is not resource!"};
        }
        if (!obj.resource?.traits?.cuttable) {
            return {ok: false, message: "This resource is not cuttable!"};
        }

        const meta = HEXOBJECT_META[obj.hexobjectKey];
        const cutCfg = meta?.actions?.[EHexActionType.CUT];

        const requiredTool: TToolKeys = cutCfg?.requiredTool ?? HEXOBJECT_KEYS.AXE;
        const durationMs: number = cutCfg?.durationMs ?? 5000;
        const costPct: number = cutCfg?.durabilityCostPct ?? 0.1;

        if (requiredTool && tool !== requiredTool) {
            return {ok: false, message: `Need a tool: ${requiredTool}`};
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canCut) return {ok: false, message: "Need something to cut with!"};

        const heroToolStore = useHeroToolStore();
        const okDur = heroToolStore.consumeDurability(costPct);
        if (!okDur) {
            heroToolStore.activeTool = HEXOBJECT_KEYS.HAND;
            return {ok: false, message: "Tool is broken!"};
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

        return {ok: true, endsAt};
    },

    [EHexActionType.MINE]: (tile, tool, now) => {
        const obj = tile.hexobject;
        if (!obj) return {ok: false, message: "Hex has no object!"};

        const a = tile.pendingAction;
        if (a) {
            if (now < a.endsAt) return {ok: false, message: "Tile is busy!"};

            tile.pendingAction = null;
        }

        if (obj.groupType !== EHexobjectGroup.RESOURCE) {
            return {ok: false, message: "It is not resource!"};
        }
        if (!obj.resource?.traits?.mineable) {
            return {ok: false, message: "This resource is not mineable!"};
        }

        const meta = HEXOBJECT_META[obj.hexobjectKey];
        const mineCfg = meta?.actions?.[EHexActionType.MINE];

        const requiredTool: TToolKeys = mineCfg?.requiredTool ?? HEXOBJECT_KEYS.PICKAXE;
        const durationMs: number = mineCfg?.durationMs ?? 10000;
        const costPct: number = mineCfg?.durabilityCostPct ?? 0.1;

        if (requiredTool && tool !== requiredTool) {
            return {ok: false, message: `Need a tool: ${requiredTool}`};
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canMine) return {ok: false, message: "Need something to mine with!"};

        const heroToolStore = useHeroToolStore();
        const okDur = heroToolStore.consumeDurability(costPct);
        if (!okDur) {
            heroToolStore.activeTool = HEXOBJECT_KEYS.HAND;
            return {ok: false, message: "Tool is broken!"};
        }

        const endsAt = now + durationMs;

        tile.pendingAction = {
            type: EHexActionType.MINE,
            startedAt: now,
            endsAt,
            hexobjectKey: obj.hexobjectKey,
            cancelled: false,
        };

        if ((heroToolStore as any).lockTool) {
            (heroToolStore as any).lockTool(tile, endsAt);
        }

        return {ok: true, endsAt};
    },

    [EHexActionType.TAKE]: (tile, tool, now) => {
        const obj = tile.hexobject;

        if (!obj) return { ok: false, message: "Hex has no object!" };
        if (!obj.isInteractable) return { ok: false, message: "This object cannot be taken!" };
        if (isBusy(tile, now)) return { ok: false, message: "Tile is busy!" };

        const canTakeByGroup =
            obj.groupType === EHexobjectGroup.RESOURCE ||
            obj.groupType === EHexobjectGroup.LOOT ||
            obj.groupType === EHexobjectGroup.TOOL;

        if (!canTakeByGroup) {
            return { ok: false, message: "This object cannot be taken!" };
        }

        if (obj.groupType === EHexobjectGroup.RESOURCE) {
            if (!obj.resource?.isAvailable) {
                return { ok: false, message: "Resource is not available!" };
            }

            const traits: IResourceTraits = obj.resource?.traits ?? {};
            if (!traits.pickable) {
                return { ok: false, message: "This resource cannot be taken by hand!" };
            }
        }

        const meta = HEXOBJECT_META[obj.hexobjectKey];
        const cfg = meta?.actions?.[EHexActionType.TAKE];

        const requiredTool = cfg?.requiredTool ?? HEXOBJECT_KEYS.HAND;
        const durationMs = cfg?.durationMs ?? 300;
        const costPct = cfg?.durabilityCostPct ?? 0;

        if (requiredTool && tool !== requiredTool) {
            return { ok: false, message: `Need a tool: ${requiredTool}` };
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canPickup) {
            return { ok: false, message: "Need something to pick up with!" };
        }

        const heroToolStore = useHeroToolStore();
        const okDur = heroToolStore.consumeDurability(costPct);

        if (!okDur) {
            heroToolStore.activeTool = HEXOBJECT_KEYS.HAND;
            return { ok: false, message: "Tool is broken!" };
        }

        const endsAt = now + durationMs;

        tile.pendingAction = {
            type: EHexActionType.TAKE,
            startedAt: now,
            endsAt,
            hexobjectKey: obj.hexobjectKey,
            cancelled: false,
        };

        heroToolStore.lockTool(tile, endsAt);

        return { ok: true, endsAt };
    },

    [EHexActionType.USE]: (tile, tool, now) => {
        const obj = tile.hexobject;
        if (!obj) return { ok: false, message: "Hex has no object!" };
        if (isBusy(tile, now)) return { ok: false, message: "Tile is busy!" };

        const meta = HEXOBJECT_META[obj.hexobjectKey];
        const cfg = meta?.actions?.[EHexActionType.USE];
        if (!cfg) return { ok: false, message: "This object cannot be used!" };

        const requiredTool = cfg.requiredTool ?? HEXOBJECT_KEYS.HAND;
        if (requiredTool && tool !== requiredTool) {
            return { ok: false, message: `Need a tool: ${requiredTool}` };
        }

        const cap = getToolCapabilities(tool);
        if (!cap.canUse) {
            return { ok: false, message: "This tool can't use the object!" };
        }

        const heroStore = useHeroStore();
        const heroToolStore = useHeroToolStore();

        let durationMs = cfg.durationMs ?? 10_000;
        const pendingMeta: Record<string, any> = {};

        if (obj.hexobjectKey === HEXOBJECT_KEYS.FIREPLACE) {
            const maxHealth = Math.max(1, heroStore.hero.maxHealth ?? 1);
            const currentHealth = Math.max(0, heroStore.hero.currentHealth ?? 0);
            const missingHealth = Math.max(0, maxHealth - currentHealth);

            if (missingHealth < 1) {
                return { ok: false, message: "Health is already full." };
            }

            durationMs = 10_000;
            pendingMeta.healAmount = 1;
        }

        const endsAt = now + durationMs;

        tile.pendingAction = {
            type: EHexActionType.USE,
            startedAt: now,
            endsAt,
            hexobjectKey: obj.hexobjectKey,
            cancelled: false,
            meta: pendingMeta,
        };

        heroToolStore.lockTool(tile, endsAt);
        return { ok: true, endsAt };
    },

    [EHexActionType.ATTACK]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return {ok: false, message: "Hex is busy!"};
        const worldMapStore = useWorldMapStore();
        const res = worldMapStore.performHeroCombatAttack(tile, _tool);
        if (!res.ok) return { ok: false, message: res.message };
        return { ok: true, endsAt: now };
    },

    [EHexActionType.OPEN]: (tile, _tool, now) => {
        if (isBusy(tile, now)) return {ok: false, message: "Hex is busy!"};
        return {ok: false, message: "OPEN is not implemented yet!"};
    },

    [EHexActionType.ENTER]: (tile, tool, now) => {
        const heroToolStore = useHeroToolStore();
        const heroStore = useHeroStore();
        const gameEventsStore = useGameEventsStore();
        const worldStore = useWorldMapStore();

        if (isBusy(tile, now)) return { ok:false, message:"Hex is busy!" };
        if (worldStore.combatActive) return { ok:false, message:"Cannot leave the map during combat!" };

        const key = tile.hexobject?.hexobjectKey;
        if (!key) return { ok:false, message:"No object to enter!" };

        const meta = HEXOBJECT_META[key];
        const cfg = meta?.actions?.[EHexActionType.ENTER];

        const requiredToolKey = (cfg?.requiredTool ?? HEXOBJECT_KEYS.HAND) as TToolKeys;
        if (requiredToolKey && tool !== requiredToolKey) {
            return { ok:false, message:`Need a tool: ${requiredToolKey}` };
        }

        heroToolStore.clearResolvedActions();
        heroToolStore.stopTool();

        const cap = getToolCapabilities(tool);
        if (!cap.canEnter) return { ok:false, message:"This tool can't enter!" };

        const heroName = heroStore.hero?.name ?? "Hero";
        const destination = meta?.subtitle ?? key;

        if (meta?.enter?.type === "WORLD") {
            if (worldStore.isLocationRespawning(meta.enter.locationKey)) {
                const remainingSeconds = Math.ceil(worldStore.getLocationRespawnRemainingMs(meta.enter.locationKey) / 1000);
                return { ok:false, message:`Opens in ${remainingSeconds}s` };
            }

            gameEventsStore.push(heroName, `navigated to ${destination}!`, "NAVIGATION");

            worldStore.goToLocation(meta.enter.locationKey);

            router.push({ name: ROUTES.WORLD, params: { locationKey: meta.enter.locationKey } });
        }

        return { ok:true, endsAt: now + 100 };
    },
};
