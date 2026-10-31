import { onScopeDispose, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_HANDS } from '@hexoflat/engine/battle/battle-state';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { controlledHero } from './battle-board-tap';
import { activateBattleHand } from './use-battle-view';
import { useBattleWarnings } from './use-battle-warnings';

export function useBattleReaction(): void {
  const store = useBattleStore();
  const heroToolStore = useHeroToolStore();
  const { send } = useBattleWarnings();
  const { t } = useI18n();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function currentKey(): string {
    const reaction = store.projection?.reaction;
    const hero = controlledHero(store.projection, store.localHeroIds);
    return reaction && hero ? `${hero.id}:${reaction.stage}:${reaction.deadlineMs}` : '';
  }

  function open() {
    stop();
    const reaction = store.projection?.reaction;
    const hero = controlledHero(store.projection, store.localHeroIds);
    if (!reaction || !hero) return;
    timer = setTimeout(
      () => send(() => store.act({ kind: 'reaction-timeout' })),
      Math.max(0, reaction.deadlineMs - Date.now()),
    );
    if (reaction.stage !== 'block') return;
    const shield = BATTLE_HANDS.find((hand) => !!hero.hands[hand]?.shieldCapacity);
    if (shield) activateBattleHand(shield);
    heroToolStore.setActionMessage(t('battle.warn.underAttack'));
  }

  watch(currentKey, (key) => (key ? open() : stop()), { immediate: true });
  onScopeDispose(stop);
}
