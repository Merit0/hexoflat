import { THexobjectPrototype } from "@/abstraction/hexobject-abstraction";
import { THexobjectKey } from "@/registry/hexobjects-registry";

import { RESOURCE_PROTOTYPES } from "./resources.prototypes";
import { LOOT_PROTOTYPES } from "./loot.prototypes";
import { CREATURE_PROTOTYPES } from "./creatures.prototypes";
import { TOOL_PROTOTYPES } from "./tools.prototypes";
import { CONSTRUCTION_PROTOTYPES } from "./constructions.prototypes";
import {deepFreeze} from "@/utils/freeze/deep-freeze";

export const HEX_OBJECT_PROTOTYPES = deepFreeze({
    ...RESOURCE_PROTOTYPES,
    ...LOOT_PROTOTYPES,
    ...CREATURE_PROTOTYPES,
    ...TOOL_PROTOTYPES,
    ...CONSTRUCTION_PROTOTYPES,
}) satisfies Record<THexobjectKey, THexobjectPrototype>;