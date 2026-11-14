import { reactive } from 'vue';
import type { BattleHand } from '@hexoflat/engine/battle/battle-state';
import { stageMode } from './battle-stage';
import type { BattleUiState } from './battle-view-types';

export const battleUi = reactive<BattleUiState>({
  stage: 'move',
  mode: 'move',
  hand: null,
  swapHand: 'left',
  hover: null,
  toolAt: null,
  selectedId: null,
  confirmLeave: false,
});

export function resetBattleUi(): void {
  battleUi.stage = 'move';
  battleUi.mode = 'move';
  battleUi.hand = null;
  battleUi.swapHand = 'left';
  battleUi.hover = null;
  battleUi.toolAt = null;
  battleUi.selectedId = null;
  battleUi.confirmLeave = false;
}

export function activateBattleHand(hand: BattleHand): void {
  battleUi.stage = 'action';
  battleUi.mode = stageMode('action');
  battleUi.hand = hand;
  battleUi.toolAt = null;
}
