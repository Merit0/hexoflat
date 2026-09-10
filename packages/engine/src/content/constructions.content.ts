import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import type { TContentDefinition } from './content-schema';

export type TConstructionKeys =
  | typeof HEXOBJECT_KEYS.CAMPING_ENTRANCE
  | typeof HEXOBJECT_KEYS.CAVE_ENTRANCE
  | typeof HEXOBJECT_KEYS.HOMELAND_GATE
  | typeof HEXOBJECT_KEYS.FIREPLACE
  | typeof HEXOBJECT_KEYS.HEALING_SPRING
  | typeof HEXOBJECT_KEYS.WOOD_AND_LEAVES
  | typeof HEXOBJECT_KEYS.GRAVE;

export const CONSTRUCTION_CONTENT: Record<TConstructionKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
    hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Camping Gate',
    subtitle: 'Camping',
    description: 'This is the Camping',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-constructs/camping-door-hex.png',
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.ENTER]: {
        label: 'Enter',
        durationMs: 400,
        requiredTool: HEXOBJECT_KEYS.HAND,
      },
    },
    enter: { type: 'WORLD', locationKey: 'camping' },
  },

  [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
    hexobjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Cave Entrance',
    subtitle: 'Forgotten Cave',
    description: 'This is the Cave',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.CAVE_ENTRANCE}-token-image.png`,
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.ENTER]: {
        label: 'Enter',
        durationMs: 400,
        requiredTool: HEXOBJECT_KEYS.HAND,
      },
    },
    enter: { type: 'WORLD', locationKey: 'cave' },
  },

  [HEXOBJECT_KEYS.HOMELAND_GATE]: {
    hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Homeland Gate',
    subtitle: 'Silesia',
    description: 'This is the Silesia entrance!',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-constructs/camping-door-hex.png',
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.ENTER]: {
        label: 'Enter',
        durationMs: 400,
        requiredTool: HEXOBJECT_KEYS.HAND,
      },
    },
    enter: { type: 'WORLD', locationKey: 'silesia' },
  },

  [HEXOBJECT_KEYS.FIREPLACE]: {
    hexobjectKey: HEXOBJECT_KEYS.FIREPLACE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Fireplace',
    subtitle: 'Rest spot',
    description: 'This is the best place to relex!',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.FIREPLACE}-token-image.png`,
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.USE]: {
        label: 'Use',
        durationMs: 10_000,
        requiredTool: HEXOBJECT_KEYS.HAND,
      },
    },
    heal: { amountPerTick: 1 },
  },

  [HEXOBJECT_KEYS.HEALING_SPRING]: {
    hexobjectKey: HEXOBJECT_KEYS.HEALING_SPRING,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Healing Spring',
    subtitle: 'Rest spot',
    description: 'A spring whose waters mend wounds faster than a campfire.',
    collision: EHexCollision.SOLID,
    // Placeholder art — reuses the fireplace sprite until this gets its own asset.
    spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.FIREPLACE}-token-image.png`,
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.USE]: {
        label: 'Use',
        durationMs: 10_000,
        requiredTool: HEXOBJECT_KEYS.HAND,
      },
    },
    heal: { amountPerTick: 2 },
  },

  [HEXOBJECT_KEYS.WOOD_AND_LEAVES]: {
    hexobjectKey: HEXOBJECT_KEYS.WOOD_AND_LEAVES,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: false,
    title: 'Nature',
    subtitle: 'Decoration',
    description: 'This is the nature!',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-resources/tree-hex.png',
    construction: { integrity: 0, isLocked: false },
  },

  [HEXOBJECT_KEYS.GRAVE]: {
    hexobjectKey: HEXOBJECT_KEYS.GRAVE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: false,
    title: 'Grave',
    subtitle: 'A fallen enemy rests here.',
    description: 'A fresh grave marks a fallen enemy.',
    collision: EHexCollision.NONE,
    spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.GRAVE}-token-image.svg`,
    construction: { integrity: 1000, isLocked: false },
  },
};
