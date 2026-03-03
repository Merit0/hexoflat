import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";

type TCreatureMetaKeys =
    | typeof HEXOBJECT_KEYS.SKELETOR
    | typeof HEXOBJECT_KEYS.EMITTER
    | typeof HEXOBJECT_KEYS.INFERNO;

export const CREATURE_META: Record<TCreatureMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.SKELETOR]: {
        key: HEXOBJECT_KEYS.SKELETOR,
        title: "Skeletor",
        subtitle: "Boss",
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.EMITTER]: {
        key: HEXOBJECT_KEYS.EMITTER,
        title: "Emitter",
        subtitle: "Boss",
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.INFERNO]: {
        key: HEXOBJECT_KEYS.INFERNO,
        title: "Inferno",
        subtitle: "Boss",
        actions: {},
        yields: {},
    },
};