import {EHexCollision, EHexobjectGroup, THexobjectPrototype} from "@/abstraction/hexobject-abstraction";
import {HEXOBJECT_KEYS, THexobjectKey} from "@/registry/hexobjects-registry";

export const HEX_OBJECT_PROTOTYPES: Record<THexobjectKey, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.TREE]: {
        hexobjectKey: HEXOBJECT_KEYS.TREE,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: "This is the Tree",
        resource: {
            isAvailable: true,
            regrowMs: 1000 * 60 * 5,
            regrowAt: null,
            traits: {
                collectable: true,
                cuttable: true
            },
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hexs/terrain-hexs/tree-hex-image.png',
    },

    [HEXOBJECT_KEYS.COINS]: {
        hexobjectKey: HEXOBJECT_KEYS.COINS,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: 'U are lucky and find the Coins',
        resource: {
            isAvailable: true,
            amount: 1,
            traits: {
                collectable: true,
                pickupable: true
            },
            regrowMs: null,
            regrowAt: null,
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hexs/terrain-hexs/coins-hex-image.png',
    },

    [HEXOBJECT_KEYS.ROCK]: {
        hexobjectKey: HEXOBJECT_KEYS.ROCK,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: 'This is the Rock!',
        resource: {
            isAvailable: true,
            traits: { mineable: true },
            regrowMs: null,
            regrowAt: null,
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/a-game-scenes/map-scene/assets/hex-tile-terrain-images/rock-image.png',
    },

    [HEXOBJECT_KEYS.SKELETOR]: {
        hexobjectKey: HEXOBJECT_KEYS.SKELETOR,
        groupType: EHexobjectGroup.CREATURE,
        isInteractable: true,
        description: 'This is the Skeletor. The King of all cursed bones!',
        creature: {
            hp: 30,
            hpMax: 30,
            faction: "enemy"
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/enemy-assets/boss-hex-images/skeletor-hex-image.png',
    },

    [HEXOBJECT_KEYS.AXE]: {
        hexobjectKey: HEXOBJECT_KEYS.AXE,
        groupType: EHexobjectGroup.TOOL,
        isInteractable: true,
        description: 'This is the Axe! Use it to cut the trees. This tool can make damage! It is very durable.',
        tool: {
            durability: 100,
            durabilityMax: 100,
            capabilities: { canCut: true },
        },
        collision: EHexCollision.NONE,
        spritePath: 'src/assets/hexs/terrain-hexs/axe-hex-image.png',
    },

    [HEXOBJECT_KEYS.CAMPING]: {
        hexobjectKey: HEXOBJECT_KEYS.CAMPING,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: false,
        description: 'This is the Camping',
        construction: {
            integrity: 1000
        },
        collision: EHexCollision.OVERLAY,
        spritePath: 'src/assets/hexs/terrain-hexs/camping-hex-image.png',
    },
};