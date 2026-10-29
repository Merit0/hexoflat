import { useI18n } from 'vue-i18n';
import type { BattleRejectionCode } from '@hexoflat/engine/battle/battle-rejection';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { controlledHero } from './battle-board-tap';
import { rejectionWarning } from './battle-warning';

export function useBattleWarnings() {
  const store = useBattleStore();
  const heroToolStore = useHeroToolStore();
  const { t } = useI18n();

  function warn(code: BattleRejectionCode, cost: number | null) {
    if (code === 'INSUFFICIENT_WILL') {
      heroToolStore.setActionMessage(t('knowledge.insufficientWill'), 'will', cost);
      return;
    }
    heroToolStore.setActionMessage(t(`battle.reject.${code}`));
  }

  function lockedWarning(): boolean {
    if (store.inputLocked) {
      heroToolStore.setActionMessage(t('battle.warn.enemyTurn'));
      return true;
    }
    const view = store.projection;
    if (!view || view.phase === 'ended' || view.task) return false;
    if (controlledHero(view, store.localHeroIds)) return false;
    warn('NOT_YOUR_TURN', null);
    return true;
  }

  function send(run: () => boolean): boolean {
    const before = store.lastHeroEvents;
    const accepted = run();
    if (accepted || store.lastHeroEvents === before) return accepted;
    const warning = rejectionWarning(store.lastHeroEvents);
    if (warning) warn(warning.code, warning.cost);
    return accepted;
  }

  return { warn, send, lockedWarning };
}
