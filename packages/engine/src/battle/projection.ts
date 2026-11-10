import type { DomainEvent } from '../commands/types';
import type { BattleHex, BattleSide, BattleState, PendingStrike } from './battle-state';
import { creatureById } from './battle-board';

export type ProjectedStrike = Omit<PendingStrike, 'fromHex'> & { fromHex: BattleHex | null };
type HiddenFields = 'pending' | 'seed' | 'reaction' | 'taskHistory' | 'wounds' | 'turnClockMs';
export type BattleProjection = Omit<BattleState, HiddenFields> & {
  viewer: BattleSide;
  pending: ProjectedStrike[];
  shieldsRaised: boolean;
  reaction?: {
    stage: 'block' | 'aim';
    attackerId: string;
    defenderId: string;
    deadlineMs: number;
    ranged: boolean;
  };
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

function publicPart(state: BattleState, viewer: BattleSide): Omit<BattleState, HiddenFields> {
  const copy: Partial<BattleState> = structuredClone(state);
  delete copy.seed;
  delete copy.pending;
  delete copy.reaction;
  delete copy.taskHistory;
  delete copy.wounds;
  delete copy.turnClockMs;
  if (copy.task) copy.task = { ...copy.task, answer: 0 };
  copy.creatures = copy.creatures?.map((creature) =>
    creature.side === viewer ? creature : { ...creature, bag: [] },
  );
  if (creatureById(state, state.activeId)?.side !== viewer) copy.undo = [];
  return copy as Omit<BattleState, HiddenFields>;
}

function hidesActiveShields(state: BattleState, viewer: BattleSide): boolean {
  const acting = state.phase === 'act' || !!state.reaction;
  return acting && creatureById(state, state.activeId)?.side !== viewer;
}

function aimView(state: BattleState, view: BattleProjection, viewer: BattleSide): BattleProjection {
  const reaction = state.reaction!;
  const defenderSide = creatureById(state, reaction.defenderId)?.side;
  if (viewer === defenderSide) {
    return { ...view, placedShields: reaction.shields.map((hex) => ({ ...hex })) };
  }
  return { ...view, shieldsRaised: reaction.shields.length > 0 };
}

export function projectBattleForViewer(state: BattleState, viewer: BattleSide): BattleProjection {
  const pending = state.pending.map((s) => projectStrike(state, s, viewer));
  const reaction = state.reaction
    ? {
        stage: state.reaction.stage,
        attackerId: state.reaction.attackerId,
        defenderId: state.reaction.defenderId,
        deadlineMs: state.reaction.deadlineMs,
        ranged: state.reaction.ranged,
      }
    : undefined;
  const view = {
    ...publicPart(state, viewer),
    viewer,
    pending,
    reaction,
    shieldsRaised: false,
  };
  if (state.reaction?.stage === 'aim') return aimView(state, view, viewer);
  return hidesActiveShields(state, viewer)
    ? { ...view, placedShields: [], shieldsRaised: state.placedShields.length > 0 }
    : view;
}

export function projectBattleEvent(
  state: BattleState,
  event: DomainEvent,
  viewer: BattleSide,
): DomainEvent {
  if (event.type === 'SHIELD_PLACED' || event.type === 'SHIELD_REMOVED') {
    const shield = event.payload as { creatureId: string };
    if (creatureById(state, shield.creatureId)?.side === viewer) return event;
    return { type: event.type, payload: { creatureId: shield.creatureId } };
  }
  if (event.type === 'REACTION_AIMING') {
    const aiming = event.payload as { attackerId: string; options: BattleHex[] };
    if (attackerSide(state, aiming.attackerId) === viewer) return event;
    return { type: event.type, payload: { ...aiming, options: [] } };
  }
  if (event.type !== 'STRIKE_DEALT') return event;
  const payload = event.payload as { attackerId: string; fromHex: BattleHex };
  if (attackerSide(state, payload.attackerId) === viewer) return event;
  return { type: event.type, payload: { ...payload, fromHex: null } };
}
