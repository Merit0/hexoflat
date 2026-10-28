import { BATTLE_RULES } from '@hexoflat/engine/battle/battle-content';
import { battleItem } from '@hexoflat/engine/battle/battle-catalogue';
import type { BattleCreature } from '@hexoflat/engine/battle/battle-state';
import { battlefieldSeed, generateBattlefield } from '@hexoflat/engine/battle/battlefield';
import { projectBattleForViewer } from '@hexoflat/engine/battle/projection';
import { startBattle } from '@hexoflat/engine/battle/start-battle';
import { deployBattle, type Vector } from '@hexoflat/engine/encounters/battlefield-setup';
import type { BattleBannerProps } from '@/render/battle/battle-banner';
import {
  battleOverlayModel,
  type BattleOverlayModel,
  type BattleTargetMode,
} from '@/render/battle/battle-overlay-model';
import type { BattleBoardScene } from '@/render/battle/use-battle-board';

export const DEV_APPROACHES: Record<string, Vector> = {
  west: { x: -1, y: 0 },
  east: { x: 1, y: 0 },
  'north-west': { x: -0.5, y: -0.866 },
  'north-east': { x: 0.5, y: -0.866 },
  'south-west': { x: -0.5, y: 0.866 },
  'south-east': { x: 0.5, y: 0.866 },
};

const DEV_SQUAD = ['skeleton-king', 'skeleton-warrior', 'skeleton-warrior', 'skeleton-archer'];

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
    bag: [],
  };
}

export interface DevBattlefieldOptions {
  seed: string;
  approach: string;
  ambush: boolean;
  showZones: boolean;
  mode: BattleTargetMode | null;
}

export interface DevBattlefieldView {
  scene: BattleBoardScene;
  overlay: BattleOverlayModel;
  banner: BattleBannerProps;
}

export function buildDevBattlefield(options: DevBattlefieldOptions): DevBattlefieldView {
  const field = generateBattlefield('crypt', battlefieldSeed(options.seed, 0));
  const { setup, zones } = deployBattle({
    battleId: 'dev',
    field,
    heroes: [devBattleHero('merito')],
    members: DEV_SQUAD,
    direction: DEV_APPROACHES[options.approach] ?? DEV_APPROACHES.west,
    ambush: options.ambush,
  });
  const battle = startBattle(setup).battle;
  const projection = projectBattleForViewer(battle, 'heroes');
  return {
    scene: {
      biome: field.biome,
      board: field.board,
      boulders: field.boulders,
      creatures: battle.creatures,
      activeId: battle.activeId,
    },
    overlay: battleOverlayModel(
      { projection, zones: options.showZones ? zones : null, mode: options.mode, results: [] },
      BATTLE_RULES,
    ),
    banner: {
      place: 'Bone Crypt',
      round: battle.round,
      actor: battle.activeId,
      will: battle.turnWill,
    },
  };
}
