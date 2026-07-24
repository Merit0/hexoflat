import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { IHexobjectMeta } from "@/registry/hexobject-meta/hexobject-meta-abstraction";
import { EHexobjectGroup } from "@/abstraction/hexobject-abstraction";

type TEquipmentMetaKeys =
    | typeof HEXOBJECT_KEYS.SWORD
    | typeof HEXOBJECT_KEYS.SHIELD;

export const EQUIPMENT_META: Record<TEquipmentMetaKeys, IHexobjectMeta> = {
    [HEXOBJECT_KEYS.SWORD]: {
        key: HEXOBJECT_KEYS.SWORD,
        title: "Guard Sword",
        subtitle: "Weapon",
        traits: {
            weightKG: 1.8,
        },
        inventory: {
            group: EHexobjectGroup.EQUIPMENT,
        },
        equip: {
            slot: "weapon",
        },
        actions: {},
    },

    [HEXOBJECT_KEYS.SHIELD]: {
        key: HEXOBJECT_KEYS.SHIELD,
        title: "Field Shield",
        subtitle: "Shield",
        traits: {
            weightKG: 2.6,
        },
        inventory: {
            group: EHexobjectGroup.EQUIPMENT,
        },
        equip: {
            slot: "shield",
        },
        actions: {},
    },
};
