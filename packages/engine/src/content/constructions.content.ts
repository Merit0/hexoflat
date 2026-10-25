import { EChestType, EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import { EHexActionType } from '../enums/hex-action-type';
import type { TContentDefinition } from './content-schema';

export type TConstructionKeys =
  | typeof HEXOBJECT_KEYS.KNOWLEDGE_BOOK
  | typeof HEXOBJECT_KEYS.CAMPING_ENTRANCE
  | typeof HEXOBJECT_KEYS.CAVE_ENTRANCE
  | typeof HEXOBJECT_KEYS.CAVE_EXIT
  | typeof HEXOBJECT_KEYS.HOMELAND_GATE
  | typeof HEXOBJECT_KEYS.FIREPLACE
  | typeof HEXOBJECT_KEYS.HEALING_SPRING
  | typeof HEXOBJECT_KEYS.WOOD_AND_LEAVES
  | typeof HEXOBJECT_KEYS.GRAVE
  | typeof HEXOBJECT_KEYS.CHEST
  | typeof HEXOBJECT_KEYS.STASH_CHEST
  | typeof HEXOBJECT_KEYS.STONE_WALL
  | typeof HEXOBJECT_KEYS.RETURN_PORTAL;

export const CONSTRUCTION_CONTENT: Record<TConstructionKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.KNOWLEDGE_BOOK]: {
    hexobjectKey: HEXOBJECT_KEYS.KNOWLEDGE_BOOK,
    tags: ['challenge'],
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'content.knowledgeBook.title',
    subtitle: 'content.knowledgeBook.subtitle',
    description: 'content.knowledgeBook.description',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-constructs/open-book-table-token-image.png',
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.USE]: {
        label: 'knowledge.open',
        requiredTool: HEXOBJECT_KEYS.HAND,
        willCost: 0,
      },
    },
  },
  [HEXOBJECT_KEYS.CAMPING_ENTRANCE]: {
    hexobjectKey: HEXOBJECT_KEYS.CAMPING_ENTRANCE,
    tags: ['portal'],
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
        willCost: 0,
      },
    },
    enter: { type: 'WORLD', locationKey: 'camping' },
  },

  [HEXOBJECT_KEYS.CAVE_ENTRANCE]: {
    hexobjectKey: HEXOBJECT_KEYS.CAVE_ENTRANCE,
    tags: ['portal'],
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
        willCost: 2,
      },
    },
    enter: { type: 'WORLD', locationKey: 'cave' },
  },

  [HEXOBJECT_KEYS.CAVE_EXIT]: {
    hexobjectKey: HEXOBJECT_KEYS.CAVE_EXIT,
    tags: ['portal'],
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Cave Exit',
    subtitle: 'Silesia',
    description: 'A way back out of the cave',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-constructs/${HEXOBJECT_KEYS.CAVE_EXIT}-token-image.png`,
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.ENTER]: {
        label: 'Enter',
        durationMs: 400,
        requiredTool: HEXOBJECT_KEYS.HAND,
        willCost: 0,
      },
    },
    enter: { type: 'WORLD', locationKey: 'silesia' },
  },

  [HEXOBJECT_KEYS.HOMELAND_GATE]: {
    hexobjectKey: HEXOBJECT_KEYS.HOMELAND_GATE,
    tags: ['portal'],
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
        willCost: 0,
      },
    },
    enter: { type: 'WORLD', locationKey: 'silesia' },
  },

  [HEXOBJECT_KEYS.FIREPLACE]: {
    hexobjectKey: HEXOBJECT_KEYS.FIREPLACE,
    tags: ['rest'],
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
        willCost: 1,
      },
    },
    heal: { amountPerTick: 1 },
  },

  [HEXOBJECT_KEYS.HEALING_SPRING]: {
    hexobjectKey: HEXOBJECT_KEYS.HEALING_SPRING,
    tags: ['rest'],
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
        willCost: 1,
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

  [HEXOBJECT_KEYS.CHEST]: {
    hexobjectKey: HEXOBJECT_KEYS.CHEST,
    tags: ['treasure'],
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Chest',
    subtitle: 'Treasure',
    description: 'A locked chest. Someone left it here.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/chest-token.png',
    construction: { integrity: 1000, isLocked: false, chestType: EChestType.LOOT },
    actions: {
      [EHexActionType.OPEN]: {
        label: 'Open',
        requiredTool: HEXOBJECT_KEYS.HAND,
        willCost: 2,
      },
    },
  },

  [HEXOBJECT_KEYS.STASH_CHEST]: {
    hexobjectKey: HEXOBJECT_KEYS.STASH_CHEST,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    title: 'Stash Chest',
    subtitle: 'Storage',
    description: 'A shared storage crate for the camp.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/stash-chest-token-image.png',
    construction: { integrity: 1000, isLocked: false, chestType: EChestType.STASH },
    actions: {
      [EHexActionType.OPEN]: {
        label: 'Open',
        requiredTool: HEXOBJECT_KEYS.HAND,
        willCost: 0,
      },
    },
  },

  [HEXOBJECT_KEYS.STONE_WALL]: {
    hexobjectKey: HEXOBJECT_KEYS.STONE_WALL,
    tags: ['blocker'],
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: false,
    title: 'Stone Wall',
    subtitle: 'Impassable',
    description: 'A wall of solid stone.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-resources/rock-token-image.png',
    construction: { integrity: 1000, isLocked: false },
  },

  [HEXOBJECT_KEYS.GRAVE]: {
    hexobjectKey: HEXOBJECT_KEYS.GRAVE,
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: false,
    title: 'Grave',
    subtitle: 'A fallen enemy rests here.',
    description: 'A fresh grave marks a fallen enemy.',
    collision: EHexCollision.NONE,
    construction: { integrity: 1000, isLocked: false },
  },

  [HEXOBJECT_KEYS.RETURN_PORTAL]: {
    hexobjectKey: HEXOBJECT_KEYS.RETURN_PORTAL,
    tags: ['portal'],
    groupType: EHexobjectGroup.CONSTRUCTION,
    isInteractable: true,
    alwaysVisible: true,
    title: 'Return Portal',
    subtitle: 'A way home',
    description: 'A shimmering gate that links this place with the camp.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-constructs/hero-portal/portal-runes-frame.png',
    construction: { integrity: 1000, isLocked: false },
    actions: {
      [EHexActionType.OPEN]: {
        label: 'Open',
        requiredTool: HEXOBJECT_KEYS.HAND,
        willCost: 0,
      },
    },
    enter: { type: 'PORTAL' },
  },
};
