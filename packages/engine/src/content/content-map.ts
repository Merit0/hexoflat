import { deepFreeze } from '../utils/freeze/deep-freeze';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';
import { RESOURCE_CONTENT } from './resources.content';
import { LOOT_CONTENT } from './loot.content';
import { CREATURE_CONTENT } from './creatures.content';
import { TOOL_CONTENT } from './tools.content';
import { CONSTRUCTION_CONTENT } from './constructions.content';
import { EQUIPMENT_CONTENT } from './equipment.content';

export const CONTENT = deepFreeze({
  ...RESOURCE_CONTENT,
  ...LOOT_CONTENT,
  ...CREATURE_CONTENT,
  ...TOOL_CONTENT,
  ...CONSTRUCTION_CONTENT,
  ...EQUIPMENT_CONTENT,
}) satisfies Record<THexobjectKey, TContentDefinition>;
