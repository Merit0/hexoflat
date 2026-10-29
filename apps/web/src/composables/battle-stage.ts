import type { BattleCreature, BattleHand, BattleItem } from '@hexoflat/engine/battle/battle-state';
import { BATTLE_HANDS } from '@hexoflat/engine/battle/battle-state';
import type { BattleUiMode } from './battle-board-tap';

export const BATTLE_STAGES = ['attack', 'move', 'block'] as const;
export type BattleStage = (typeof BATTLE_STAGES)[number];

export interface BattleStageView {
  id: BattleStage;
  current: boolean;
}

export function stageMode(stage: BattleStage): BattleUiMode {
  if (stage === 'attack') return 'strike';
  return stage;
}

export function stageViews(current: BattleStage): BattleStageView[] {
  return BATTLE_STAGES.map((id) => ({ id, current: id === current }));
}

export function handFitsStage(item: BattleItem | null, stage: BattleStage): boolean {
  if (stage === 'attack') return !item || !!item.power;
  if (stage === 'block') return !!item?.shieldCapacity;
  return false;
}

export function stageHands(hero: BattleCreature, stage: BattleStage): BattleHand[] {
  return BATTLE_HANDS.filter((hand) => handFitsStage(hero.hands[hand], stage));
}
