import { inject, type InjectionKey } from 'vue';
import { useBattleStore, type BattleStoreInstance } from '@/stores/battle-store';

export const BATTLE_STORE_KEY: InjectionKey<BattleStoreInstance> = Symbol('battle-store');

export function useBattleStoreContext(): BattleStoreInstance {
  return inject(BATTLE_STORE_KEY, null) ?? useBattleStore();
}
