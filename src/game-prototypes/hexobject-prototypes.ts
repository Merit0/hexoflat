import {EHexCollision, EHexobjectGroup, THexobjectPrototype} from "@/abstraction/hexobject-abstraction";

export const HEX_OBJECT_PROTOTYPES: Record<string, THexobjectPrototype> = {
    tree: {
        hexobjectKey: "tree",
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
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/tree-tile-image.png',
    },

    coin: {
        hexobjectKey: "coin",
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
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/coin-image.png',
    },

    rock: {
        hexobjectKey: 'rock',
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
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/rock-image.png',
    },

    skeletor: {
        hexobjectKey: 'skeletor',
        groupType: EHexobjectGroup.CREATURE,
        isInteractable: true,
        description: 'This is the Creature!',
        creature: {
            hp: 30,
            hpMax: 30,
            faction: "enemy"
        },
        collision: EHexCollision.SOLID,
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/skeletor-boss-image.png',
    },

    axe: {
        hexobjectKey: 'axe',
        groupType: EHexobjectGroup.TOOL,
        isInteractable: true,
        description: 'This is the Axe! Use it to cut the trees. This tool can make damage! It is very durable.',
        tool: {
            durability: 100,
            durabilityMax: 100,
            capabilities: { canCut: true },
        },
        collision: EHexCollision.NONE,
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/axe-tile-image.png',
    },

    camping: {
        hexobjectKey: "camping",
        groupType: EHexobjectGroup.CONSTRUCTION,
        isInteractable: false,
        description: 'This is the Camping',
        construction: {
            integrity: 1000
        },
        collision: EHexCollision.OVERLAY,
        spritePath: 'src/a-game-scenes/homeland-scene/assets/hex-tile-terrain-images/house-tile-image.png',
    },
};