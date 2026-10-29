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
  if (copy.task) copy.task = { ...copy.task, answer: 0 };
  return copy as Omit<BattleState, 'pending' | 'seed'>;
}

function ownGuards(state: BattleState, viewer: BattleSide): BattleState['guards'] {
  return Object.fromEntries(
    Object.entries(state.guards).filter(([id]) => creatureById(state, id)?.side === viewer),
  );
}

function hidesActiveShields(state: BattleState, viewer: BattleSide): boolean {
  return state.phase === 'act' && creatureById(state, state.activeId)?.side !== viewer;
}

export function projectBattleForViewer(state: BattleState, viewer: BattleSide): BattleProjection {
  const pending = state.pending.map((s) => projectStrike(state, s, viewer));
  const view = { ...publicPart(state), viewer, pending, guards: ownGuards(state, viewer) };
  return hidesActiveShields(state, viewer) ? { ...view, placedShields: [] } : view;
}

export function projectBattleEvent(
  state: BattleState,
  event: DomainEvent,
  viewer: BattleSide,
): DomainEvent {
  if (event.type === 'SHIELD_PLACED' || event.type === 'SHIELD_REMOVED') {
    const shield = event.payload as { creatureId: string; guard?: boolean };
    if (!shield.guard || creatureById(state, shield.creatureId)?.side === viewer) return event;
    return { type: event.type, payload: { creatureId: shield.creatureId, guard: true } };
  }
  if (event.type !== 'STRIKE_DEALT') return event;
  const payload = event.payload as { attackerId: string; fromHex: BattleHex };
  if (attackerSide(state, payload.attackerId) === viewer) return event;
  return { type: event.type, payload: { ...payload, fromHex: null } };
}
