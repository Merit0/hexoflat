import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";
import {EHexActionType} from "@/enums/hex-action-type";

type TConstructionMetaKeys =
    | typeof HEXOBJECT_KEYS.CAMPING_ENTRANCE
    | typeof HEXOBJECT_KEYS.CAVE_ENTRANCE
    | typeof HEXOBJECT_KEYS.HOMELAND_GATE
    | typeof HEXOBJECT_KEYS.FIREPLACE
    | typeof HEXOBJECT_KEYS.WOOD_AND_LEAVES
    | typeof HEXOBJECT_KEYS.GRAVE;

export const CONSTRUCTION_META: Record<TConstructionMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        title: "Camping Gate",
        subtitle: "Camping",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HEXOBJECT_KEYS.HAND,
            },
        },
        enter: {
            type: "WORLD",
            locationKey: "camping",
        },
    },

    [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAVE_ENTRANCE,
        title: "Cave Entrance",
        subtitle: "Forgotten Cave",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HEXOBJECT_KEYS.HAND,
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
        subtitle: "Silesia",
        actions: {
            [EHexActionType.ENTER]: {
                label: "Enter",
                durationMs: 400,
                requiredTool: HEXOBJECT_KEYS.HAND,
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
        actions: {
            [EHexActionType.USE]: {
                label: "Use",
                durationMs: 10_000,
                requiredTool: HEXOBJECT_KEYS.HAND,
            },
        }
    },

    [HEXOBJECT_KEYS.WOOD_AND_LEAVES]: {
        key: HEXOBJECT_KEYS.WOOD_AND_LEAVES,
        title: "Nature",
        subtitle: "Decoration"
    },

    [HEXOBJECT_KEYS.GRAVE]: {
        key: HEXOBJECT_KEYS.GRAVE,
        title: "Grave",
        subtitle: "A fallen enemy rests here.",
    },
};
