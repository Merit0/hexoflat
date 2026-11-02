import { EHexCollision, EHexobjectGroup, ERarityKind } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TLootKeys =
  | typeof HEXOBJECT_KEYS.COINS
  | typeof HEXOBJECT_KEYS.HEALTH_BOTTLE
  | typeof HEXOBJECT_KEYS.ENERGY_BOTTLE
  | typeof HEXOBJECT_KEYS.MANA_BOTTLE
  | typeof HEXOBJECT_KEYS.RETURN_SCROLL
  | typeof HEXOBJECT_KEYS.BONE_CHARM
  | typeof HEXOBJECT_KEYS.CROWN_SHARD;

export const LOOT_CONTENT: Record<TLootKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.COINS]: {
    hexobjectKey: HEXOBJECT_KEYS.COINS,
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Coins',
    subtitle: 'Lucky find',
    description: 'U are lucky and find the Coins',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/coins-hex.png',
    loot: {
      name: 'Coins',
      amount: 1,
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.COINS,
        weightKG: 0.001,
      },
    },
  },

  [HEXOBJECT_KEYS.HEALTH_BOTTLE]: {
    hexobjectKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Health Potion',
    subtitle: 'Restores health',
    description: 'Bottle of Health potion!',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.HEALTH_BOTTLE}-token-image.png`,
    loot: {
      name: 'Health Potion',
      amount: 1,
      rarity: { kind: ERarityKind.IDOL, boss: false },
      usePrice: 3,
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.HEALTH_BOTTLE,
        maxStack: 10,
        weightKG: 0.1,
      },
    },
  },

  [HEXOBJECT_KEYS.ENERGY_BOTTLE]: {
    hexobjectKey: HEXOBJECT_KEYS.ENERGY_BOTTLE,
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Energy Potion',
    subtitle: 'Restores energy',
    description: 'Bottle of Energy potion!',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.ENERGY_BOTTLE}-token-image.png`,
    loot: {
      name: 'Energy Potion',
      amount: 10,
      rarity: { kind: ERarityKind.IDOL, boss: false },
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.ENERGY_BOTTLE,
        maxStack: 10,
        weightKG: 0.1,
      },
    },
  },

  [HEXOBJECT_KEYS.MANA_BOTTLE]: {
    hexobjectKey: HEXOBJECT_KEYS.MANA_BOTTLE,
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Mana Potion',
    subtitle: 'Restores mana',
    description: 'Bottle of Mana potion!',
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.MANA_BOTTLE}-token-image.png`,
    loot: {
      name: 'Mana Potion',
      amount: 10,
      rarity: { kind: ERarityKind.IDOL, boss: false },
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.MANA_BOTTLE,
        maxStack: 10,
        weightKG: 0.1,
      },
    },
  },

  [HEXOBJECT_KEYS.RETURN_SCROLL]: {
    hexobjectKey: HEXOBJECT_KEYS.RETURN_SCROLL,
    tags: ['portal', 'rare'],
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Return Scroll',
    subtitle: 'Opens a portal home',
    description: 'A one-use scroll. Use it next to you to open a portal to the camp.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/teleport-scroll-token.png',
    actions: {
      [EHexActionType.USE]: {
        label: 'Use',
        requiredTool: HEXOBJECT_KEYS.RETURN_SCROLL,
      },
    },
    loot: {
      name: 'Return Scroll',
      amount: 1,
      rarity: { kind: ERarityKind.SPARK, boss: false },
      usePrice: 10,
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.RETURN_SCROLL,
        maxStack: 50,
        weightKG: 0.05,
      },
    },
  },

  [HEXOBJECT_KEYS.BONE_CHARM]: {
    hexobjectKey: HEXOBJECT_KEYS.BONE_CHARM,
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Bone Charm',
    subtitle: 'Carved from a fallen guard',
    description: 'A small charm of bone, still cold from the crypt.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/bone-charm-token.svg',
    loot: {
      name: 'Bone Charm',
      amount: 1,
      rarity: { kind: ERarityKind.GLOOM, boss: false },
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.BONE_CHARM,
        maxStack: 10,
        weightKG: 0.05,
      },
    },
  },

  [HEXOBJECT_KEYS.CROWN_SHARD]: {
    hexobjectKey: HEXOBJECT_KEYS.CROWN_SHARD,
    tags: ['rare'],
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Crown Shard',
    subtitle: 'A piece of a broken crown',
    description: 'A shard of the crown worn by the king of the crypt.',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/emitter-token-image.png',
    loot: {
      name: 'Crown Shard',
      amount: 1,
      rarity: { kind: ERarityKind.GLOOM, boss: true },
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.CROWN_SHARD,
        maxStack: 10,
        weightKG: 0.1,
      },
    },
  },
};
