import type { BattleUiMode } from './battle-board-tap';

export const BATTLE_STAGES = ['action', 'move'] as const;
export type BattleStage = (typeof BATTLE_STAGES)[number];

export function stageMode(stage: BattleStage): BattleUiMode {
  return stage === 'action' ? 'strike' : 'move';
}
