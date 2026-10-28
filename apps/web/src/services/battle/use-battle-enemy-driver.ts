import { onBeforeUnmount, watch } from 'vue';
import { useBattleStore } from '@/stores/battle-store';

export const ENEMY_TURN_DELAY_MS = 700;

export function useBattleEnemyDriver(delayMs: number = ENEMY_TURN_DELAY_MS): void {
  const store = useBattleStore();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  watch(
    () => (store.needsEnemyTurn ? store.battle : null),
    (pending) => {
      stop();
      if (!pending) return;
      timer = setTimeout(() => {
        timer = null;
        store.runEnemyTurn();
      }, delayMs);
    },
    { immediate: true },
  );

  onBeforeUnmount(stop);
}
