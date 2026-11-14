import type { BattleStoreInstance } from '@/stores/battle-store';
import {
  acknowledgeGraveExitWarning,
  needsGraveExitWarning,
} from '@/services/battle/grave-exit-warning';
import { battleUi, resetBattleUi } from './battle-ui-state';

export function useBattleLeave(store: BattleStoreInstance) {
  async function leave(): Promise<boolean> {
    if (needsGraveExitWarning(store.projection)) {
      battleUi.confirmLeave = true;
      return false;
    }
    resetBattleUi();
    return store.leave();
  }

  async function confirmLeave(): Promise<boolean> {
    if (!(await acknowledgeGraveExitWarning())) return false;
    resetBattleUi();
    return store.leave();
  }

  function cancelLeave() {
    battleUi.confirmLeave = false;
  }

  return { leave, confirmLeave, cancelLeave };
}
