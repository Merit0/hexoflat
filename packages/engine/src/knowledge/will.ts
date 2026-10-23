import type { DomainEvent } from '../commands/types';
import type { HexTileModel } from '../map/models/hex-tile-model';
import type { EHexActionType } from '../enums/hex-action-type';
import { getMeta } from '../content/content-accessors';
import type { KnowledgeState } from './state';

export type WillSource =
  { kind: 'hall'; ref: string } | { kind: 'item'; ref: string } | { kind: 'dev'; ref: string };
export type WillSpendReason = 'step' | 'action' | 'entry' | 'combat-boost' | 'skill';
export type WillRejectReason = 'INSUFFICIENT_WILL' | 'NO_WILL_STATE';

export function grantWill(
  state: KnowledgeState,
  amount: number,
  source: WillSource,
): DomainEvent[] {
  const granted = Math.min(Math.max(0, Math.floor(amount)), state.capacity - state.current);
  if (granted <= 0) return [];
  state.current += granted;
  return [
    {
      type: 'WILL_GRANTED',
      payload: { heroId: state.heroId, amount: granted, source, balanceAfter: state.current },
    },
  ];
}

export function spendWill(
  state: KnowledgeState,
  amount: number,
  reason: WillSpendReason,
  ref: string,
): { ok: boolean; events: DomainEvent[] } {
  if (amount <= 0) return { ok: true, events: [] };
  if (state.current < amount)
    return { ok: false, events: [willRejected(state.heroId, 'INSUFFICIENT_WILL', ref)] };
  state.current -= amount;
  return {
    ok: true,
    events: [
      {
        type: 'WILL_SPENT',
        payload: { heroId: state.heroId, amount, reason, ref, balanceAfter: state.current },
      },
    ],
  };
}

export function willRejected(heroId: string, reason: WillRejectReason, ref: string): DomainEvent {
  return { type: 'WILL_REJECTED', payload: { heroId, reason, ref } };
}

export function actionWillCost(tile: HexTileModel, actionType: EHexActionType): number {
  const key = tile.hexobject?.hexobjectKey;
  return key ? (getMeta(key)?.actions?.[actionType]?.willCost ?? 0) : 0;
}
