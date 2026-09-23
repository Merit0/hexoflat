import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TEquipmentKeys = typeof HEXOBJECT_KEYS.SWORD | typeof HEXOBJECT_KEYS.SHIELD;

export type THandEquipmentKeys = TEquipmentKeys;
export type THeroToolKey =
  | typeof HEXOBJECT_KEYS.HAND
  | typeof HEXOBJECT_KEYS.AXE
  | typeof HEXOBJECT_KEYS.PICKAXE
  | THandEquipmentKeys;

export const EQUIPMENT_CONTENT: Record<TEquipmentKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.SWORD]: {
    hexobjectKey: HEXOBJECT_KEYS.SWORD,
    groupType: EHexobjectGroup.EQUIPMENT,
    isInteractable: true,
    title: 'Guard Sword',
    subtitle: 'Weapon',
    description: 'Guard Sword. A balanced melee weapon for close combat.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-loot/sword-hex.png',
    equipment: {
      durability: 100,
      durabilityMax: 100,
      capabilities: { canAttack: true },
      traits: { weightKG: 1.8 },
    },
    weapon: {
      damageMin: 1,
      damageMax: 1,
      attackMultiplier: 1.2,
    },
    equip: { slot: 'weapon' },
  },

  [HEXOBJECT_KEYS.SHIELD]: {
    hexobjectKey: HEXOBJECT_KEYS.SHIELD,
    groupType: EHexobjectGroup.EQUIPMENT,
    isInteractable: true,
    title: 'Field Shield',
    subtitle: 'Shield',
    description: 'Field Shield. Meant to catch and redirect a hit in melee.',
    collision: EHexCollision.SOLID,
    spritePath: '/hex-assets/hex-equipment/hex-weapons/hex-shield/shield-token-image.png',
    equipment: {
      durability: 120,
      durabilityMax: 120,
      defense: 2.4,
      capabilities: { canBlock: true },
      traits: { weightKG: 2.6 },
    },
    equip: { slot: 'shield' },
  },
};
