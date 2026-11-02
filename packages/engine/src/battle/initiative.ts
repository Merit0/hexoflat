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
  return Object.keys(draws).sort((a, b) => draws[a] - draws[b]);
}

export function drawWithAdvantage(
  ids: string[],
  favoured: ReadonlySet<string>,
  rng: RandomNumberGenerator,
): Record<string, number> {
  const bag = ids.map((_, index) => index + 1);
  const take = () => bag.splice(Math.floor(rng() * bag.length), 1)[0];
  const draws: Record<string, number> = {};
  for (const id of ids.filter((i) => favoured.has(i))) {
    const pair = bag.length > 1 ? [take(), take()] : [take()];
    draws[id] = Math.min(...pair);
    if (pair.length > 1) bag.push(Math.max(...pair));
  }
  for (const id of ids.filter((i) => !favoured.has(i))) draws[id] = take();
  return draws;
}

function favouredIds(state: BattleState): ReadonlySet<string> {
  if (state.round !== 1 || !state.advantage) return new Set();
  return new Set(state.creatures.filter((c) => c.side === state.advantage).map((c) => c.id));
}

export function rollRound(state: BattleState): { draws: Record<string, number>; order: string[] } {
  const ids = state.creatures.filter(isAlive).map((c) => c.id);
  const favoured = favouredIds(state);
  const rng = initiativeStream(state, state.round);
  const draws = favoured.size ? drawWithAdvantage(ids, favoured, rng) : drawInitiative(ids, rng);
  return { draws, order: orderByDraws(draws) };
}
