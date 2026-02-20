import {HeroToolType} from "@/enums/hero-tool-type";
import {EHexActionType} from "@/enums/hex-action-type";
import {HEXOBJECT_KEYS, THexobjectKey} from "@/registry/hexobjects-registry";
import {LocationKey} from "@/registry/world-map-registry";

export interface HexobjectMeta {
    key: string;

    // UI
    title: string;
    subtitle?: string;

    // allowed actions
    actions?: Partial<Record<EHexActionType, {
        label: string;
        durationMs?: number;
        requiredTool?: HeroToolType;
        durabilityCostPct?: number;
    }>>;

    // rewards
    yields?: {
        wood?: number;
        coins?: number;
        stone?: number;
    };

    enter?: {
        type: "WORLD";
        locationKey: LocationKey;
        spawn?: "remember" | "default";
    };

    route?: {
        name: string;
        build?: (key: string) => {
            params?: Record<string, any>;
            query?: Record<string, any>;
        };
    };
}

export const HEXOBJECT_META: Record<THexobjectKey, HexobjectMeta> = {
    [HEXOBJECT_KEYS.TREE]: {
        key: HEXOBJECT_KEYS.TREE,
        title: "Tree",
        subtitle: "Can be chopped",
        actions: {
            [EHexActionType.CUT]: {
                label: "Chop",
                durationMs: 5000,
                requiredTool: HeroToolType.AXE,
                durabilityCostPct: 0.1,
            },
        },
        yields: { wood: 1 },
    },

    [HEXOBJECT_KEYS.ROCK]: {
        key: HEXOBJECT_KEYS.ROCK,
        title: "Rock",
        subtitle: "Can be mined",
        actions: {
            [EHexActionType.MINE]: {
                label: "Mine",
                durationMs: 6000,
                requiredTool: HeroToolType.PICKAXE,
                durabilityCostPct: 0.1,
            },
        },
        yields: { stone: 1 },
    },

    [HEXOBJECT_KEYS.COINS]: {
        key: HEXOBJECT_KEYS.COINS,
        title: "Coin",
        subtitle: "Pick it up",
        actions: {
            [EHexActionType.TAKE]: {
                label: "Take",
                durationMs: 400,
                requiredTool: HeroToolType.HAND,
                durabilityCostPct: 0,
            },
        },
        yields: { coins: 1 },
    },

    [HEXOBJECT_KEYS.SKELETOR]: { key: HEXOBJECT_KEYS.SKELETOR, title: "Skeletor" },
    [HEXOBJECT_KEYS.AXE]: { key: HEXOBJECT_KEYS.AXE, title: "Axe" },
    [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        title: "Camping Entrance",
        subtitle: "Camping",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HeroToolType.HAND,
            },
        },
        enter: {
            type: "WORLD",
            locationKey: "camping",
            spawn: "default",
        },
    },
    [HEXOBJECT_KEYS.HOMELAND_GATE]: {
        key: HEXOBJECT_KEYS.HOMELAND_GATE,
        title: "Homeland Gate",
        subtitle: "Silesia",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HeroToolType.HAND,
            },
        },
        enter: {
            type: "WORLD",
            locationKey: "homeland",
            spawn: "default",
        },
    },
};