import {HeroToolType} from "@/enums/hero-tool-type";
import {EHexActionType} from "@/enums/hex-action-type";
import {HEXOBJECT_KEYS, THexobjectKey} from "@/registry/hexobjects-registry";

export interface HexobjectMeta {
    key: THexobjectKey;

    // для UI
    title: string;
    subtitle?: string;

    // які дії дозволені для цього об’єкта (високорівнево)
    actions?: Partial<Record<EHexActionType, {
        label: string;
        durationMs?: number;          // напр. CUT 5000
        requiredTool?: HeroToolType;  // напр. "axe"
        durabilityCostPct?: number;   // напр. 0.1
    }>>;

    // що дає цей об’єкт при успішній дії (поки прості лічильники)
    yields?: {
        wood?: number;
        coins?: number;
        stone?: number;
    };

    // дефолтний респавн (якщо хочеш винести з prototype)
    regrowMsDefault?: number | null;
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
        regrowMsDefault: 30000,
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
        regrowMsDefault: null,
    },

    [HEXOBJECT_KEYS.COIN]: {
        key: HEXOBJECT_KEYS.COIN,
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
        regrowMsDefault: null,
    },

    [HEXOBJECT_KEYS.SKELETOR]: { key: HEXOBJECT_KEYS.SKELETOR, title: "Skeletor" },
    [HEXOBJECT_KEYS.AXE]: { key: HEXOBJECT_KEYS.AXE, title: "Axe" },
    [HEXOBJECT_KEYS.CAMPING]: { key: HEXOBJECT_KEYS.CAMPING, title: "Camp" },
};