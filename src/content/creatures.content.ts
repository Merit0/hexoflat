import { EHexCollision, EHexobjectGroup } from '@/abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '@/registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TCreatureKeys =
  typeof HEXOBJECT_KEYS.SKELETOR | typeof HEXOBJECT_KEYS.EMITTER | typeof HEXOBJECT_KEYS.INFERNO;

export const CREATURE_CONTENT: Record<TCreatureKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.SKELETOR]: {
    hexobjectKey: HEXOBJECT_KEYS.SKELETOR,
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'Skeletor',
    subtitle: 'Boss',
    description: 'This is the Skeletor. The King of all cursed bones!',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/skeletor-token-image.png',
    creature: {
      name: 'Skeletor',
      hp: 2,
      hpMax: 15,
      attack: 1,
      faction: 'enemy',
      visionRange: 3,
    },
  },

  [HEXOBJECT_KEYS.EMITTER]: {
    hexobjectKey: HEXOBJECT_KEYS.EMITTER,
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'Emitter',
    subtitle: 'Boss',
    description: 'This is the Emitter. The God of technology!',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/emitter-token-image.png',
    creature: { name: 'Emmiter', hp: 30, hpMax: 30, attack: 1, faction: 'enemy', visionRange: 3 },
  },

  [HEXOBJECT_KEYS.INFERNO]: {
    hexobjectKey: HEXOBJECT_KEYS.INFERNO,
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'Inferno',
    subtitle: 'Boss',
    description: 'Here is the Hell. I am, Inferno ',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/inferno-token-image.png',
    creature: { name: 'Inferno', hp: 100, hpMax: 100, attack: 1, faction: 'enemy', visionRange: 4 },
  },
};
