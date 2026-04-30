import { EHexCollision, EHexobjectGroup, THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

export type TToolKeys =
    | typeof HEXOBJECT_KEYS.AXE
    | typeof HEXOBJECT_KEYS.HAND
    | typeof HEXOBJECT_KEYS.PICKAXE;

export const TOOL_PROTOTYPES: Record<TToolKeys, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.AXE]: {
        hexobjectKey: HEXOBJECT_KEYS.AXE,
        groupType: EHexobjectGroup.TOOL,
        isInteractable: true,
        description:
            "This is the Axe! Use it to cut the trees. This tool can make damage! It is very durable.",
        tool: {
            durability: 100,
            durabilityMax: 100,
            capabilities: { canCut: true } ,
            traits: {
                weightKG: 1,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.AXE}-hex-image.png`,
    },

    [HEXOBJECT_KEYS.PICKAXE]: {
        hexobjectKey: HEXOBJECT_KEYS.PICKAXE,
        groupType: EHexobjectGroup.TOOL,
        isInteractable: true,
        description:
            "This is the Pickaxe! Use it to mine the resources. This tool can make damage! It is very durable.",
        tool: {
            durability: 100,
            durabilityMax: 100,
            capabilities: { canMine: true } ,
            traits: {
                weightKG: 1.5,
            }
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.PICKAXE}-token-image.png`,
    },

    [HEXOBJECT_KEYS.HAND]: {
        hexobjectKey: HEXOBJECT_KEYS.HAND,
        groupType: EHexobjectGroup.TOOL,
        isInteractable: true,
        description:
            "This is the Hand! Use it to pick something.",
        tool: {
            durability: 1000000,
            durabilityMax: 1000000,
            capabilities: {
                canPickup: true,
                canEnter: true,
                canUse: true,
            },
            traits: { weightKG: 0 }
        },
        collision: EHexCollision.NONE,
        spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.HAND}-hex-image.png`,
    },
};
