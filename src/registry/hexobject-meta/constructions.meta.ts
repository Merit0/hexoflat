import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";
import {HeroToolType} from "@/enums/hero-tool-type";

type TConstructionMetaKeys =
    | typeof HEXOBJECT_KEYS.CAMPING_ENTRANCE
    | typeof HEXOBJECT_KEYS.CAVE_ENTRANCE
    | typeof HEXOBJECT_KEYS.HOMELAND_GATE
    | typeof HEXOBJECT_KEYS.FIREPLACE
    | typeof HEXOBJECT_KEYS.WOOD_AND_LEAVES;

export const CONSTRUCTION_META: Record<TConstructionMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        title: "Camp",
        subtitle: "Entrance",
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
        },
    },

    [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAVE_ENTRANCE,
        title: "Cave",
        subtitle: "Entrance",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HeroToolType.HAND,
            },
        },
        enter: {
            type: "WORLD",
            locationKey: "cave",
        },
    },

    [HEXOBJECT_KEYS.HOMELAND_GATE]: {
        key: HEXOBJECT_KEYS.HOMELAND_GATE,
        title: "Homeland Gate",
        subtitle: "Entrance",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HeroToolType.HAND,
            },
        },
        enter: {
            type: "WORLD",
            locationKey: "silesia",
        },
    },

    [HEXOBJECT_KEYS.FIREPLACE]: {
        key: HEXOBJECT_KEYS.FIREPLACE,
        title: "Fireplace",
        subtitle: "Rest spot",
        actions: {}
    },

    [HEXOBJECT_KEYS.WOOD_AND_LEAVES]: {
        key: HEXOBJECT_KEYS.WOOD_AND_LEAVES,
        title: "Nature",
        subtitle: "Decoration"
    },
};