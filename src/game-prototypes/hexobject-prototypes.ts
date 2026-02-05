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
                cuttable: true,
            },
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hex-assets/hex-resources/tree-hex-image.png',
    },

    [HEXOBJECT_KEYS.COINS]: {
        hexobjectKey: HEXOBJECT_KEYS.COINS,
        groupType: EHexobjectGroup.LOOT,
        isInteractable: true,
        description: 'U are lucky and find the Coins',
        loot: {
            name: 'Coins',
            amount: 1,
            traits: {
                stackable: true,
            },
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hex-assets/hex-loot/coins-hex-image.png',
    },

    [HEXOBJECT_KEYS.ROCK]: {
        hexobjectKey: HEXOBJECT_KEYS.ROCK,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: 'This is the Rock!',
        resource: {
            isAvailable: true,
            traits: {
                mineable: true,
            },
            regrowMs: null,
            regrowAt: null,
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hex-assets/hex-resources/rock-image.png',
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
        spritePath: 'src/assets/enemy-assets/boss-hex-images/axe-hex-image.png',
    },

    [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
        hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: true,
        description: 'This is the Camping',
        construction: {
            integrity: 1000
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hex-assets/hex-constructs/camping-hex-image.png',
    },

    [HEXOBJECT_KEYS.HOMELAND_GATE]: {
        hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: true,
        construction: {
            integrity: 1000
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/assets/hex-assets/hex-constructs/camping-hex-image.png',
    },
};