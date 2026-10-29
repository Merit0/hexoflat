import type { BattleUiMode } from './battle-board-tap';

export const BATTLE_STAGES = ['action', 'move'] as const;
export type BattleStage = (typeof BATTLE_STAGES)[number];

export interface BattleStageView {
  id: BattleStage;
  current: boolean;
}

export function stageMode(stage: BattleStage): BattleUiMode {
  return stage === 'action' ? 'strike' : 'move';
}

export function stageViews(current: BattleStage): BattleStageView[] {
  return BATTLE_STAGES.map((id) => ({ id, current: id === current }));
}
