import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { makeResource } from '../utils/resource/resource-utils';
import { EHexActionType } from '../enums/hex-action-type';
import type { TContentDefinition } from './content-schema';

export type TResourceKeys =
  typeof HEXOBJECT_KEYS.TREE | typeof HEXOBJECT_KEYS.ROCK | typeof HEXOBJECT_KEYS.MOUNTAIN;

export const RESOURCE_CONTENT: Record<TResourceKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.TREE]: {
    hexobjectKey: HEXOBJECT_KEYS.TREE,
    tags: ['resource'],
    groupType: EHexobjectGroup.RESOURCE,
    isInteractable: true,
    title: 'Tree',
    subtitle: 'Can be chopped',
    description: 'This is the Tree',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-resources/tree-hex.png',
    resource: makeResource({ cuttable: true }),
    actions: {
      [EHexActionType.CUT]: {
        label: 'Chop',
        durationMs: 5000,
        requiredTool: HEXOBJECT_KEYS.AXE,
        durabilityCostPct: 0.1,
        willCost: 1,
      },
    },
    yields: { wood: 1 },
  },

  [HEXOBJECT_KEYS.ROCK]: {
    hexobjectKey: HEXOBJECT_KEYS.ROCK,
    tags: ['resource'],
    groupType: EHexobjectGroup.RESOURCE,
    isInteractable: true,
    title: 'Rock',
    subtitle: 'Can be mined',
    description: 'This is the minable Rock!',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-resources/${HEXOBJECT_KEYS.ROCK}-token-image.png`,
    resource: makeResource({ mineable: true }, { maxAmount: 10000 }),
    actions: {
      [EHexActionType.MINE]: {
        label: 'Mine',
        durationMs: 10000,
        requiredTool: HEXOBJECT_KEYS.PICKAXE,
        durabilityCostPct: 0.1,
        willCost: 2,
      },
    },
    yields: { stone: 10 },
  },

  [HEXOBJECT_KEYS.MOUNTAIN]: {
    hexobjectKey: HEXOBJECT_KEYS.MOUNTAIN,
    tags: ['resource', 'barrier'],
    groupType: EHexobjectGroup.RESOURCE,
    isInteractable: true,
    title: 'Mountain',
    subtitle: 'Can be mined through',
    description: 'A rock wall. Mine it away to open a path.',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-resources/${HEXOBJECT_KEYS.ROCK}-token-image.png`,
    alwaysVisible: true,
    tileBackground: '/hex-assets/board-hexes/stone-hex.png',
    resource: makeResource({ mineable: true }, { maxAmount: 10000 }),
    actions: {
      [EHexActionType.MINE]: {
        label: 'Mine',
        durationMs: 10000,
        requiredTool: HEXOBJECT_KEYS.PICKAXE,
        durabilityCostPct: 0.1,
        willCost: 2,
      },
    },
    yields: { stone: 10 },
  },
};
