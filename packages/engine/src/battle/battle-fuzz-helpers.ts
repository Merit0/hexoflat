import type { BattleCreature, BattleState } from './battle-state';

export function creatureById(state: BattleState, id: string): BattleCreature | undefined {
  return state.creatures.find((creature) => creature.id === id);
}

export function isAlive(creature: BattleCreature): boolean {
  return creature.hp > 0;
}
