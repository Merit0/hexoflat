import type { THexobjectKey } from "@/registry/hexobjects-registry";

import { RESOURCE_META } from "./resources.meta";
import { LOOT_META } from "./loot.meta";
import { CREATURE_META } from "./creatures.meta";
import { TOOL_META } from "./tools.meta";
import { CONSTRUCTION_META } from "./constructions.meta";
import {deepFreeze} from "@/utils/freeze/deep-freeze";
import {IHexobjectMeta} from "@/registry/hexobject-meta/hexobject-meta-abstraction";

export const HEXOBJECT_META = deepFreeze({
    ...RESOURCE_META,
    ...LOOT_META,
    ...CREATURE_META,
    ...TOOL_META,
    ...CONSTRUCTION_META,
}) satisfies Record<THexobjectKey, IHexobjectMeta>;