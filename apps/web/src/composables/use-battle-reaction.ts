import { onScopeDispose, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { BATTLE_HANDS } from '@hexoflat/engine/battle/battle-state';
import { msUntilServerTime } from '@/services/battle/battle-clock';
import { useBattleStore } from '@/stores/battle-store';
import { useHeroToolStore } from '@/stores/hero-tool-store';
import { controlledHero } from './battle-board-tap';
import { activateBattleHand } from './use-battle-view';
import { useBattleWarnings } from './use-battle-warnings';

const RETRY_MS = 250;
const MAX_RETRIES = 20;

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
    const key = currentKey();
    let attempts = 0;
    const fire = async () => {
      timer = null;
      if (currentKey() !== key) return;
      const accepted = await send(() => store.act({ kind: 'reaction-timeout' }));
      if (accepted || currentKey() !== key || attempts >= MAX_RETRIES) return;
      attempts += 1;
      timer = setTimeout(() => void fire(), RETRY_MS);
    };
    timer = setTimeout(() => void fire(), msUntilServerTime(reaction.deadlineMs));
    if (reaction.stage !== 'block') return;
    const shield = BATTLE_HANDS.find((hand) => !!hero.hands[hand]?.shieldCapacity);
    if (shield) activateBattleHand(shield);
    heroToolStore.setActionMessage(t('battle.warn.underAttack'));
  }

  watch(currentKey, (key) => (key ? open() : stop()), { immediate: true });
  onScopeDispose(stop);
}
