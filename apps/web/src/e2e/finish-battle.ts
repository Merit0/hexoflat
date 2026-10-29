import { toRaw } from 'vue';
import { useBattleStore } from '@/stores/battle-store';

export function finishOpenBattle(outcome: 'victory' | 'defeat'): void {
  const store = useBattleStore();
  if (!store.battle) throw new Error('No battle is open');
  const battle = structuredClone(toRaw(store.battle));
  const loser = outcome === 'victory' ? 'enemies' : 'heroes';
  for (const creature of battle.creatures) if (creature.side === loser) creature.hp = 0;
  battle.outcome = outcome;
  battle.phase = 'ended';
  store.battle = battle;
}
