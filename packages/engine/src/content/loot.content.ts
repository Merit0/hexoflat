import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TLootKeys =
  | typeof HEXOBJECT_KEYS.COINS
  | typeof HEXOBJECT_KEYS.HEALTH_BOTTLE
  | typeof HEXOBJECT_KEYS.ENERGY_BOTTLE
  | typeof HEXOBJECT_KEYS.MANA_BOTTLE;

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
      traits: {
        stackable: true,
        stackKey: HEXOBJECT_KEYS.MANA_BOTTLE,
        maxStack: 10,
        weightKG: 0.1,
      },
    },
  },
};
