import { EHexCollision, EHexobjectGroup } from '../abstraction/hexobject-abstraction';
import { EHexActionType } from '../enums/hex-action-type';
import { HEXOBJECT_KEYS, type THexobjectKey } from '../registry/hexobjects-registry';
import type { ISquad } from '../abstraction/hexobject-abstraction';
import type { TContentDefinition } from './content-schema';

export type TSquadKeys =
  | typeof HEXOBJECT_KEYS.LONE_SKELETON
  | typeof HEXOBJECT_KEYS.SKELETON_PACK
  | typeof HEXOBJECT_KEYS.ARCHER_WATCH
  | typeof HEXOBJECT_KEYS.BONE_COURT;

export type TCreatureKeys =
  | typeof HEXOBJECT_KEYS.SKELETOR
  | typeof HEXOBJECT_KEYS.EMITTER
  | typeof HEXOBJECT_KEYS.INFERNO
  | TSquadKeys;

const SQUAD_SPRITES = {
  skeleton: '/enemy-assets/enemies-sprites/skeleton-hex.png',
} as const;

const SQUAD_ACTIONS = {
  [EHexActionType.ATTACK]: { label: 'squad.attack', durationMs: 0, willCost: 2 },
  [EHexActionType.SCOUT]: { label: 'squad.scout', durationMs: 0, willCost: 1 },
};

function squadContent(
  key: TSquadKeys,
  sprite: keyof typeof SQUAD_SPRITES,
  squad: Omit<ISquad, 'tableRule' | 'battlefieldBiome' | 'loot'> & { loot: THexobjectKey },
): TContentDefinition {
  return {
    hexobjectKey: key,
    tags: ['enemy'],
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: `content.${key}.title`,
    description: `content.${key}.tableRule`,
    collision: EHexCollision.SOLID,
    spritePath: SQUAD_SPRITES[sprite],
    actions: SQUAD_ACTIONS,
    creature: {
      name: `content.${key}.title`,
      hp: squad.members.length,
      hpMax: squad.members.length,
      attack: 1,
      faction: 'enemy',
      squad: { ...squad, battlefieldBiome: 'crypt', tableRule: `content.${key}.tableRule` },
    },
  };
}

export const CREATURE_CONTENT: Record<TCreatureKeys, TContentDefinition> = {
  [HEXOBJECT_KEYS.LONE_SKELETON]: squadContent(HEXOBJECT_KEYS.LONE_SKELETON, 'skeleton', {
    members: ['skeleton-warrior'],
    watcher: false,
    boss: false,
    loot: HEXOBJECT_KEYS.BONE_CHARM,
  }),
  [HEXOBJECT_KEYS.SKELETON_PACK]: squadContent(HEXOBJECT_KEYS.SKELETON_PACK, 'skeleton', {
    members: ['skeleton-warrior', 'skeleton-warrior'],
    watcher: false,
    boss: false,
    loot: HEXOBJECT_KEYS.SWORD,
  }),
  [HEXOBJECT_KEYS.ARCHER_WATCH]: squadContent(HEXOBJECT_KEYS.ARCHER_WATCH, 'skeleton', {
    members: ['skeleton-archer', 'skeleton-archer'],
    watcher: true,
    boss: false,
    loot: HEXOBJECT_KEYS.HEALTH_BOTTLE,
  }),
  [HEXOBJECT_KEYS.BONE_COURT]: squadContent(HEXOBJECT_KEYS.BONE_COURT, 'skeleton', {
    members: ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'],
    watcher: false,
    boss: true,
    loot: HEXOBJECT_KEYS.CROWN_SHARD,
  }),

  [HEXOBJECT_KEYS.SKELETOR]: {
    hexobjectKey: HEXOBJECT_KEYS.SKELETOR,
    tags: ['enemy'],
    groupType: EHexobjectGroup.CREATURE,
    isInteractable: true,
    title: 'content.skeletor.title',
    subtitle: 'content.skeletor.subtitle',
    description: 'content.skeletor.description',
    collision: EHexCollision.SOLID,
    spritePath: '/enemy-assets/enemies-sprites/skeleton-hex.png',
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
    tags: ['enemy'],
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
    tags: ['enemy'],
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
