import type { DomainEvent } from '../commands/types';
import type { BattleHex, BattleSide, BattleState, PendingStrike } from './battle-state';
import { creatureById } from './battle-board';

export type ProjectedStrike = Omit<PendingStrike, 'fromHex'> & { fromHex: BattleHex | null };
export type BattleProjection = Omit<BattleState, 'pending' | 'seed'> & {
  viewer: BattleSide;
  pending: ProjectedStrike[];
};

function attackerSide(state: BattleState, attackerId: string): BattleSide | null {
  return creatureById(state, attackerId)?.side ?? null;
}

function projectStrike(
  state: BattleState,
  strike: PendingStrike,
  viewer: BattleSide,
): ProjectedStrike {
  const own = attackerSide(state, strike.attackerId) === viewer;
  return { ...strike, fromHex: own ? { ...strike.fromHex } : null };
}

function publicPart(state: BattleState): Omit<BattleState, 'pending' | 'seed'> {
  const copy: Partial<BattleState> = structuredClone(state);
  delete copy.seed;
  delete copy.pending;
  return copy as Omit<BattleState, 'pending' | 'seed'>;
}

export function projectBattleForViewer(state: BattleState, viewer: BattleSide): BattleProjection {
  const pending = state.pending.map((s) => projectStrike(state, s, viewer));
  return { ...publicPart(state), viewer, pending };
}

export function projectBattleEvent(
  state: BattleState,
  event: DomainEvent,
  viewer: BattleSide,
): DomainEvent {
  if (event.type !== 'STRIKE_DEALT') return event;
  const payload = event.payload as { attackerId: string; fromHex: BattleHex };
  if (attackerSide(state, payload.attackerId) === viewer) return event;
  return { type: event.type, payload: { ...payload, fromHex: null } };
}
