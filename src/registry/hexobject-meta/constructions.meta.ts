import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";

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
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
        key: HEXOBJECT_KEYS.CAVE_ENTRANCE,
        title: "Cave",
        subtitle: "Entrance",
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.HOMELAND_GATE]: {
        key: HEXOBJECT_KEYS.HOMELAND_GATE,
        title: "Homeland Gate",
        subtitle: "Entrance",
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.FIREPLACE]: {
        key: HEXOBJECT_KEYS.FIREPLACE,
        title: "Fireplace",
        subtitle: "Rest spot",
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.WOOD_AND_LEAVES]: {
        key: HEXOBJECT_KEYS.WOOD_AND_LEAVES,
        title: "Nature",
        subtitle: "Decoration",
        actions: {},
        yields: {},
    },
};