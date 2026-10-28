import { deriveStream } from '../utils/random-seeded';
import type { RandomNumberGenerator } from '../utils/random';
import type { BattleState } from './battle-state';
import { isAlive } from './battle-board';

export function initiativeStream(state: BattleState, round: number): RandomNumberGenerator {
  return deriveStream(state.seed, `battle:${state.id}:init:${round}`);
}

export function drawInitiative(ids: string[], rng: RandomNumberGenerator): Record<string, number> {
  const tokens = ids.map((_, index) => index + 1);
  for (let i = tokens.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tokens[i], tokens[j]] = [tokens[j], tokens[i]];
  }
  return Object.fromEntries(ids.map((id, index) => [id, tokens[index]]));
}

export function orderByDraws(draws: Record<string, number>): string[] {
  return Object.keys(draws).sort((a, b) => draws[b] - draws[a]);
}

export function rollRound(state: BattleState): { draws: Record<string, number>; order: string[] } {
  const ids = state.creatures.filter(isAlive).map((c) => c.id);
  const draws = drawInitiative(ids, initiativeStream(state, state.round));
  return { draws, order: orderByDraws(draws) };
}
