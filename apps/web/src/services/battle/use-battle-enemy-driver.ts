import { onBeforeUnmount, watch } from 'vue';
import { useBattleStore } from '@/stores/battle-store';
import { BATTLE_TIMING } from '@/render/battle/battle-timing';

export function useBattleEnemyDriver(delayMs: number = BATTLE_TIMING.enemyTurnDelayMs): void {
  const store = useBattleStore();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  watch(
    () => (store.needsEnemyTurn ? store.projection : null),
    (pending) => {
      stop();
      if (!pending) return;
      timer = setTimeout(() => {
        timer = null;
        void store.runEnemyTurn();
      }, delayMs);
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);
}
