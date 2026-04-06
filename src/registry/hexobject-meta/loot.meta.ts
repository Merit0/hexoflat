import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";

type TLootMetaKeys =
    | typeof HEXOBJECT_KEYS.COINS
    | typeof HEXOBJECT_KEYS.HEALTH_BOTTLE
    | typeof HEXOBJECT_KEYS.ENERGY_BOTTLE
    | typeof HEXOBJECT_KEYS.MANA_BOTTLE;

export const LOOT_META: Record<TLootMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.COINS]: {
        key: HEXOBJECT_KEYS.COINS,
        title: "Coins",
        subtitle: "Lucky find",
        traits: {
            stackable: true,
            stackKey: HEXOBJECT_KEYS.COINS,
            weightKG: 0.001
        },
        actions: {},      // або взагалі можеш не мати actions, якщо тип дозволяє
        yields: {},       // loot зазвичай дається не через yields, а через loot-прототип
    },

    [HEXOBJECT_KEYS.HEALTH_BOTTLE]: {
        key: HEXOBJECT_KEYS.HEALTH_BOTTLE,
        title: "Health Potion",
        subtitle: "Restores health",
        traits: {
            stackable: true,
            stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
            maxStack: 10,
            weightKG: 0.1
        },
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.ENERGY_BOTTLE]: {
        key: HEXOBJECT_KEYS.ENERGY_BOTTLE,
        title: "Energy Potion",
        subtitle: "Restores energy",
        traits: {
            stackable: true,
            stackKey: HEXOBJECT_KEYS.ENERGY_BOTTLE,
            maxStack: 10,
            weightKG: 0.1
        },
        actions: {},
        yields: {},
    },

    [HEXOBJECT_KEYS.MANA_BOTTLE]: {
        key: HEXOBJECT_KEYS.MANA_BOTTLE,
        title: "Mana Potion",
        subtitle: "Restores mana",
        traits: {
            stackable: true,
            stackKey: HEXOBJECT_KEYS.MANA_BOTTLE,
            maxStack: 10,
            weightKG: 0.1
        },
        actions: {},
        yields: {},
    },
};