import { EDimension } from '../dimensions/dimensions';
import { EHexCollision, EHexobjectGroup, ETokenType } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TLootKeys =
  | typeof HEXOBJECT_KEYS.COINS
  | typeof HEXOBJECT_KEYS.HEALTH_BOTTLE
  | typeof HEXOBJECT_KEYS.ENERGY_BOTTLE
  | typeof HEXOBJECT_KEYS.MANA_BOTTLE
  | typeof HEXOBJECT_KEYS.RETURN_SCROLL;

export const LOOT_CONTENT: Record<TLootKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.COINS]: {
    hexobjectKey: HEXOBJECT_KEYS.COINS,
    dimension: EDimension.EARTH,
    sharedWith: 'all',
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
    dimension: EDimension.EARTH,
    sharedWith: 'all',
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Health Potion',
    subtitle: 'Restores health',
    description: 'Bottle of Health potion!',
    coinPrice: 20,
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.HEALTH_BOTTLE}-token-image.png`,
    loot: {
      name: 'Health Potion',
      amount: 1,
      tokenType: { kind: ETokenType.IDOL, boss: false },
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
    dimension: EDimension.EARTH,
    sharedWith: 'all',
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Energy Potion',
    subtitle: 'Restores energy',
    description: 'Bottle of Energy potion!',
    coinPrice: 20,
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.ENERGY_BOTTLE}-token-image.png`,
    loot: {
      name: 'Energy Potion',
      amount: 10,
      tokenType: { kind: ETokenType.IDOL, boss: false },
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
    dimension: EDimension.EARTH,
    sharedWith: 'all',
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Mana Potion',
    subtitle: 'Restores mana',
    description: 'Bottle of Mana potion!',
    coinPrice: 20,
    collision: EHexCollision.SOLID,
    spritePath: `/hex-assets/hex-loot/${HEXOBJECT_KEYS.MANA_BOTTLE}-token-image.png`,
    loot: {
      name: 'Mana Potion',
      amount: 10,
      tokenType: { kind: ETokenType.IDOL, boss: false },
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
    dimension: EDimension.HEAVEN,
    sharedWith: 'all',
    tags: ['portal', 'rare'],
    groupType: EHexobjectGroup.LOOT,
    isInteractable: true,
    title: 'Return Scroll',
    subtitle: 'Opens a portal home',
    description: 'A one-use scroll. Use it next to you to open a portal to the camp.',
    coinPrice: 60,
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
      tokenType: { kind: ETokenType.SPARK, boss: false },
      usePrice: 10,
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.RETURN_SCROLL,
        maxStack: 50,
        weightKG: 0.05,
      },
    },
  },
};
