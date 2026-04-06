import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";

type TResourceMetaKeys =
    | typeof HEXOBJECT_KEYS.TREE
    | typeof HEXOBJECT_KEYS.ROCK;

export const RESOURCE_META: Record<TResourceMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.TREE]: {
        key: HEXOBJECT_KEYS.TREE,
        title: "Tree",
        subtitle: "Can be chopped",
        actions: {
            [EHexActionType.CUT]: {
                label: "Chop",
                durationMs: 5000,
                requiredTool: HEXOBJECT_KEYS.AXE,
                durabilityCostPct: 0.1,
            },
        },
        yields: { wood: 1 },
        traits:{
            weightKG: 1,
        }
    },

    [HEXOBJECT_KEYS.ROCK]: {
        key: HEXOBJECT_KEYS.ROCK,
        title: "Rock",
        subtitle: "Can be mined",
        actions: {
            [EHexActionType.MINE]: {
                label: "Mine",
                durationMs: 10000,
                requiredTool: HEXOBJECT_KEYS.PICKAXE,
                durabilityCostPct: 0.1,
            },
        },
        yields: { stone: 10 },
        traits:{
            weightKG: 1,
        }
    },
};