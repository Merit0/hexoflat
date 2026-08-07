import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { HEXOBJECT_KEYS } from '../registry/hexobjects-registry';
import type { TContentDefinition } from './content-schema';

export type TCreatureKeys =
  typeof HEXOBJECT_KEYS.SKELETOR | typeof HEXOBJECT_KEYS.EMITTER | typeof HEXOBJECT_KEYS.INFERNO;

export const CREATURE_CONTENT: Record<TCreatureKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.SKELETOR]: {
    hexobjectKey: HEXOBJECT_KEYS.SKELETOR,
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'content.skeletor.title',
    subtitle: 'content.skeletor.subtitle',
    description: 'content.skeletor.description',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/skeletor-token-image.png',
    creature: {
      name: 'content.skeletor.title',
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
    title: 'content.emitter.title',
    subtitle: 'content.emitter.subtitle',
    description: 'content.emitter.description',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/emitter-token-image.png',
    creature: {
      name: 'content.emitter.title',
      hp: 30,
      hpMax: 30,
      attack: 1,
      faction: 'enemy',
      visionRange: 3,
    },
  },

  [HEXOBJECT_KEYS.INFERNO]: {
    hexobjectKey: HEXOBJECT_KEYS.INFERNO,
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'content.inferno.title',
    subtitle: 'content.inferno.subtitle',
    description: 'content.inferno.description',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/boss-hex-images/inferno-token-image.png',
    creature: {
      name: 'content.inferno.title',
      hp: 100,
      hpMax: 100,
      attack: 1,
      faction: 'enemy',
      visionRange: 4,
    },
  },
};
