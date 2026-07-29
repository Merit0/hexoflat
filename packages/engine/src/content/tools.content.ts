import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TToolKeys =
  typeof HEXOBJECT_KEYS.AXE | typeof HEXOBJECT_KEYS.HAND | typeof HEXOBJECT_KEYS.PICKAXE;

export const TOOL_CONTENT: Record<TToolKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.AXE]: {
    hexobjectKey: HEXOBJECT_KEYS.AXE,
    groupType: EHexobjectGroup.TOOL,
    isInteractable: true,
    title: 'Axe',
    subtitle: 'Tool',
    description:
      'This is the Axe! Use it to cut the trees. This tool can make damage! It is very durable.',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.AXE}-hex-image.png`,
    tool: {
      durability: 100,
      durabilityMax: 100,
      attackMultiplier: 1,
      capabilities: { canCut: true, canAttack: true },
      traits: { weightKG: 1 },
    },
  },

  [HEXOBJECT_KEYS.PICKAXE]: {
    hexobjectKey: HEXOBJECT_KEYS.PICKAXE,
    groupType: EHexobjectGroup.TOOL,
    isInteractable: true,
    title: 'Pickaxe',
    subtitle: 'Tool',
    description:
      'This is the Pickaxe! Use it to mine the resources. This tool can make damage! It is very durable.',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.PICKAXE}-token-image.png`,
    tool: {
      durability: 100,
      durabilityMax: 100,
      capabilities: { canMine: true },
      traits: { weightKG: 1.5 },
    },
  },

  [HEXOBJECT_KEYS.HAND]: {
    hexobjectKey: HEXOBJECT_KEYS.HAND,
    groupType: EHexobjectGroup.TOOL,
    isInteractable: true,
    title: 'Hand',
    subtitle: 'Tool',
    description: 'This is the Hand! Use it to pick something.',
    collision: EHexCollision.NONE,
    spritePath: `/hex-assets/hex-tools/${HEXOBJECT_KEYS.HAND}-hex-image.png`,
    tool: {
      durability: 1000000,
      durabilityMax: 1000000,
      attackMultiplier: 0.1,
      defense: 0.1,
      capabilities: {
        canPickup: true,
        canEnter: true,
        canUse: true,
        canAttack: true,
        canBlock: true,
      },
      traits: { weightKG: 0 },
    },
  },
};
