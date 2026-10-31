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

export function giveHeroTheTurn(willPerTurn: number): void {
  const store = useBattleStore();
  if (!store.battle) throw new Error('No battle is open');
  const battle = structuredClone(toRaw(store.battle));
  const hero = battle.creatures.find((creature) => creature.side === 'heroes');
  if (!hero) throw new Error('No hero in the battle');
  battle.order = [hero.id, ...battle.order.filter((id) => id !== hero.id)];
  battle.turnIndex = 0;
  battle.activeId = hero.id;
  battle.phase = 'act';
  battle.turnWill = willPerTurn;
  battle.pending = [];
  battle.reaction = undefined;
  battle.placedShields = [];
  battle.undo = [];
  store.battle = battle;
}

export interface BattleHandsSnapshot {
  right: string | null;
  left: string | null;
  bag: string[];
  will: number;
}

export function readBattleHands(): BattleHandsSnapshot | null {
  const battle = useBattleStore().battle;
  const hero = battle?.creatures.find((creature) => creature.side === 'heroes');
  if (!battle || !hero) return null;
  return {
    right: hero.hands.right?.key ?? null,
    left: hero.hands.left?.key ?? null,
    bag: hero.bag.map((item) => item.key),
    will: battle.turnWill,
  };
}

export function battleTestHooks() {
  return {
    getBattleHands(): BattleHandsSnapshot | null {
      return readBattleHands();
    },
    giveHeroTheTurn(): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      giveHeroTheTurn(20);
    },
    finishBattle(outcome: 'victory' | 'defeat'): void {
      if (import.meta.env.VITE_E2E_HOOKS !== 'true') return;
      finishOpenBattle(outcome);
    },
  };
}
