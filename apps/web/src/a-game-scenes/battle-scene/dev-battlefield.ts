import { battleItem } from '@hexoflat/engine/battle/battle-catalogue';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { battlefieldSeed, generateBattlefield } from '@hexoflat/engine/battle/battlefield';
import { deployBattle, type Vector } from '@hexoflat/engine/encounters/battlefield-setup';
import { CAVE_MODEL } from '@hexoflat/engine/content/boards/models/cave';
import type { BattleDeploy } from '@/stores/battle-store';

export const DEV_REFERENCE_FRAME = {
  width: CAVE_MODEL.frame.columns,
  height: CAVE_MODEL.frame.rows,
};

const WEST: Vector = { x: -1, y: 0 };
const BONE_COURT = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior'];

export const DEV_APPROACHES: Record<string, Vector> = {
  west: WEST,
  east: { x: 1, y: 0 },
  'north-west': { x: -0.5, y: -0.866 },
  'north-east': { x: 0.5, y: -0.866 },
  'south-west': { x: -0.5, y: 0.866 },
  'south-east': { x: 0.5, y: 0.866 },
};

const APPROACH_LABELS: Record<string, string> = {
  west: 'W',
  east: 'E',
  'north-west': 'NW',
  'north-east': 'NE',
  'south-west': 'SW',
  'south-east': 'SE',
};

export const DEV_SQUADS: Record<string, string[]> = {
  'skeleton-pack': ['skeleton-warrior', 'skeleton-warrior'],
  'bone-court': BONE_COURT,
  'lone-skeleton': ['skeleton-warrior'],
};

const DEV_HEROES = [
  { id: 'merito', name: 'Merito' },
  { id: 'lina', name: 'Lina' },
];

export function devBattleHero(id: string): BattleCreature {
  return {
    id,
    side: 'heroes',
    kind: 'hero',
    pos: { q: 0, r: 0 },
    hp: 6,
    maxHp: 6,
    weight: 1,
    force: 1,
    hands: { right: battleItem('sword'), left: battleItem('wooden-shield') },
    bag: [battleItem('dagger'), battleItem('health-potion')],
  };
}

export interface DevBattlefieldOptions {
  seed: string;
  approach: string;
  ambush: boolean;
  squad: string;
  withFriend: boolean;
}

export interface DevBattle {
  deploy: BattleDeploy;
  heroIds: string[];
}

export function buildDevBattle(options: DevBattlefieldOptions): DevBattle {
  const field = generateBattlefield('crypt', battlefieldSeed(options.seed, 0));
  const heroes = DEV_HEROES.slice(0, options.withFriend ? 2 : 1);
  const { setup, zones } = deployBattle({
    battleId: 'dev',
    field,
    heroes: heroes.map((h) => devBattleHero(h.id)),
    members: DEV_SQUADS[options.squad] ?? BONE_COURT,
    direction: DEV_APPROACHES[options.approach] ?? WEST,
    ambush: options.ambush,
  });
  return {
    heroIds: heroes.map((h) => h.id),
    deploy: {
      setup,
      zones,
      biome: field.biome,
      place: 'Bone Crypt',
      approach: APPROACH_LABELS[options.approach] ?? 'W',
      ambush: options.ambush,
      names: Object.fromEntries(heroes.map((h) => [h.id, h.name])),
    },
  };
}
