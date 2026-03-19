import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";

type TToolMetaKeys =
    | typeof HEXOBJECT_KEYS.AXE
    | typeof HEXOBJECT_KEYS.HAND
    | typeof HEXOBJECT_KEYS.PICKAXE;

export const TOOL_META: Record<TToolMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.AXE]: {
        key: HEXOBJECT_KEYS.AXE,
        title: "Axe",
        subtitle: "Tool",
        actions: {},
        yields: {},
        traits:{ weightKG: 1 }
    },

    [HEXOBJECT_KEYS.PICKAXE]: {
        key: HEXOBJECT_KEYS.PICKAXE,
        title: "Pickaxe",
        subtitle: "Tool",
        actions: {},
        yields: {},
        traits:{ weightKG: 1.5 }
    },

    [HEXOBJECT_KEYS.HAND]: {
        key: HEXOBJECT_KEYS.HAND,
        title: "Hand",
        subtitle: "Tool",
        actions: {},
        yields: {},
    },
};