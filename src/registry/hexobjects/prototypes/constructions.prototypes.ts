import { EHexCollision, EHexobjectGroup, THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

type TConstructionKeys =
    | typeof HEXOBJECT_KEYS.CAMPING_ENTRANCE
    | typeof HEXOBJECT_KEYS.CAVE_ENTRANCE
    | typeof HEXOBJECT_KEYS.HOMELAND_GATE
    | typeof HEXOBJECT_KEYS.FIREPLACE
    | typeof HEXOBJECT_KEYS.WOOD_AND_LEAVES
    | typeof HEXOBJECT_KEYS.GRAVE;

export const CONSTRUCTION_PROTOTYPES: Record<TConstructionKeys, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
        hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: true,
        description: "This is the Camping",
        construction: {
            integrity: 1000,
            isLocked: false
        },
        collision: EHexCollision.SOLID,
        spritePath: "/hex-assets/hex-constructs/camping-token-image.png",
    },

    [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
        hexobjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: true,
        description: "This is the Cave",
        construction: {
            integrity: 1000,
            isLocked: false
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.CAVE_ENTRANCE}-token-image.png`,
    },

    [HEXOBJECT_KEYS.HOMELAND_GATE]: {
        hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: true,
        description: "This is the Silesia entrance!",
        construction: {
            integrity: 1000,
            isLocked: false
        },
        collision: EHexCollision.SOLID,
        spritePath: "/hex-assets/hex-constructs/map-token-image.png",
    },

    [HEXOBJECT_KEYS.FIREPLACE]: {
        hexobjectKey: HEXOBJECT_KEYS.FIREPLACE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        description: "This is the best place to relex!",
        isInteractable: true,
        construction: {
            integrity: 1000,
            isLocked: false
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.FIREPLACE}-token-image.png`,
    },

    [HEXOBJECT_KEYS.WOOD_AND_LEAVES]: {
        hexobjectKey: HEXOBJECT_KEYS.WOOD_AND_LEAVES,
        groupType: EHexobjectGroup.CONSTRUCTION,
        description: "This is the nature!",
        isInteractable: false,
        construction: {
            integrity: 0,
            isLocked: false
        },
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.WOOD_AND_LEAVES}-token-image.png`,
    },

    [HEXOBJECT_KEYS.GRAVE]: {
        hexobjectKey: HEXOBJECT_KEYS.GRAVE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        description: "A fresh grave marks a fallen enemy.",
        isInteractable: false,
        construction: {
            integrity: 1000,
            isLocked: false
        },
        collision: EHexCollision.NONE,
        spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.GRAVE}-token-image.svg`,
    },
};