import {EHexCollision, EHexobjectGroup, THexobjectPrototype} from "@/abstraction/hexobject-abstraction";
import {HEXOBJECT_KEYS} from "@/registry/hexobjects-registry";

type TLootKeys =
    | typeof HEXOBJECT_KEYS.COINS
    | typeof HEXOBJECT_KEYS.HEALTH_BOTTLE
    | typeof HEXOBJECT_KEYS.ENERGY_BOTTLE
    | typeof HEXOBJECT_KEYS.MANA_BOTTLE;

export const LOOT_PROTOTYPES: Record<TLootKeys, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.COINS]: {
        hexobjectKey: HEXOBJECT_KEYS.COINS,
        groupType: EHexobjectGroup.LOOT,
        isInteractable: true,
        description: "U are lucky and find the Coins",
        loot: {
            name: "Coins",
            amount: 1,
            traits: {
                stackable: true,
                stackKey: HEXOBJECT_KEYS.COINS,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: "/hex-assets/hex-loot/coins-token-image.png",
    },

    [HEXOBJECT_KEYS.HEALTH_BOTTLE]: {
        hexobjectKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
        groupType: EHexobjectGroup.LOOT,
        isInteractable: true,
        description: "Bottle of Health potion!",
        loot: {
            name: "Health Potion",
            amount: 1,
            traits: {
                stackable: true,
                stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
                maxStack: 10,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.HEALTH_BOTTLE}-token-image.png`,
    },

    [HEXOBJECT_KEYS.ENERGY_BOTTLE]: {
        hexobjectKey: HEXOBJECT_KEYS.ENERGY_BOTTLE,
        groupType: EHexobjectGroup.LOOT,
        isInteractable: true,
        description: "Bottle of Energy potion!",
        loot: {
            name: "Energy Potion",
            amount: 10,
            traits: {
                stackable: true,
                stackKey: HEXOBJECT_KEYS.ENERGY_BOTTLE,
                maxStack: 10,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.ENERGY_BOTTLE}-token-image.png`,
    },

    [HEXOBJECT_KEYS.MANA_BOTTLE]: {
        hexobjectKey: HEXOBJECT_KEYS.MANA_BOTTLE,
        groupType: EHexobjectGroup.LOOT,
        isInteractable: true,
        description: "Bottle of Mana potion!",
        loot: {
            name: "Mana Potion",
            amount: 10,
            traits: {
                stackable: true,
                stackKey: HEXOBJECT_KEYS.MANA_BOTTLE,
                maxStack: 10,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.MANA_BOTTLE}-token-image.png`,
    },
};