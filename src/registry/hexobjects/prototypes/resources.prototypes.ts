import { EHexCollision, EHexobjectGroup, THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { HEXOBJECT_KEYS } from "@/registry/hexobjects-registry";
import { makeResource } from "@/utils/resource/resource-utils";

type TResourceKeys =
    | typeof HEXOBJECT_KEYS.TREE
    | typeof HEXOBJECT_KEYS.ROCK;

export const RESOURCE_PROTOTYPES: Record<TResourceKeys, THexobjectPrototype> = {
    [HEXOBJECT_KEYS.TREE]: {
        hexobjectKey: HEXOBJECT_KEYS.TREE,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: "This is the Tree",
        resource: makeResource({ cuttable: true }),
        collision: EHexCollision.SOLID,
        spritePath: "/hex-assets/hex-resources/tree-hex-image.png",
    },

    [HEXOBJECT_KEYS.ROCK]: {
        hexobjectKey: HEXOBJECT_KEYS.ROCK,
        groupType: EHexobjectGroup.RESOURCE,
        isInteractable: true,
        description: "This is the minable Rock!",
        resource: makeResource({ mineable: true }, { maxAmount: 10000 }),
        collision: EHexCollision.SOLID,
        spritePath: `/hex-assets/hex-resources/${HEXOBJECT_KEYS.ROCK}-token-image.png`,
    },
};