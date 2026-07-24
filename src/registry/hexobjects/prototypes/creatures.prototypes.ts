import { EHexCollision, EHexobjectGroup, THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";

type TCreatureKeys =
    | typeof HEXOBJECT_KEYS.SKELETOR
    | typeof HEXOBJECT_KEYS.EMITTER
    | typeof HEXOBJECT_KEYS.INFERNO;

export const CREATURE_PROTOTYPES: Record<TCreatureKeys, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.SKELETOR]: {
        hexobjectKey: HEXOBJECT_KEYS.SKELETOR,
        groupType: EHexobjectGroup.CREATURE,
        isInteractable: true,
        description: "This is the Skeletor. The King of all cursed bones!",
        creature: {
            name: 'Skeletor',
            hp: 2,
            hpMax: 15,
            attack: 1,
            faction: "enemy",
            visionRange: 3
        },
        collision: EHexCollision.SOLID,
        spritePath: "/enemy-assets/boss-hex-images/skeletor-token-image.png",
    },

    [HEXOBJECT_KEYS.EMITTER]: {
        hexobjectKey: HEXOBJECT_KEYS.EMITTER,
        groupType: EHexobjectGroup.CREATURE,
        isInteractable: true,
        description: "This is the Emitter. The God of technology!",
        creature: { name: 'Emmiter', hp: 30, hpMax: 30, attack: 1, faction: "enemy", visionRange: 3 },
        collision: EHexCollision.SOLID,
        spritePath: "/enemy-assets/boss-hex-images/emitter-token-image.png",
    },

    [HEXOBJECT_KEYS.INFERNO]: {
        hexobjectKey: HEXOBJECT_KEYS.INFERNO,
        groupType: EHexobjectGroup.CREATURE,
        isInteractable: true,
        description: "Here is the Hell. I am, Inferno ",
        creature: { name: 'Inferno', hp: 100, hpMax: 100, attack: 1, faction: "enemy", visionRange: 4 },
        collision: EHexCollision.SOLID,
        spritePath: "/enemy-assets/boss-hex-images/inferno-token-image.png",
    },
};