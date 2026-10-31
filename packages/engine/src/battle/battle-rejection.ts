import type { BattleState } from './battle-state';

export const BATTLE_REJECTION_CODES = [
  'NO_BATTLE',
  'BATTLE_ENDED',
  'NOT_YOUR_TURN',
  'WRONG_PHASE',
  'INSUFFICIENT_WILL',
  'NOT_ADJACENT',
  'HEX_BLOCKED',
  'NOT_AN_ENEMY',
  'NO_WEAPON_IN_HAND',
  'HAND_ALREADY_STRUCK',
  'NO_SHIELD_IN_HAND',
  'SHIELD_CAPACITY_REACHED',
  'SHIELD_ALREADY_PLACED',
  'NO_SHIELD_THERE',
  'NO_SHIELD_PLACED',
  'NOT_IN_RING',
  'NOTHING_TO_UNDO',
  'OUT_OF_RANGE',
  'TOO_HEAVY',
  'NO_SPACE',
  'TASK_OPEN',
  'NO_TASK',
  'TOO_CLOSE',
  'NO_SUCH_ITEM',
  'NOT_USABLE',
  'DEFENSE_MODE',
] as const;
export type BattleRejectionCode = (typeof BATTLE_REJECTION_CODES)[number];

export interface BattleRejection {
  rejected: BattleRejectionCode;
  cost?: number;
  left?: number;
}

export function reject(code: BattleRejectionCode): BattleRejection {
  return { rejected: code };
}

export function isRejection(value: unknown): value is BattleRejection {
  return typeof value === 'object' && value !== null && 'rejected' in value;
}

export function spendTurnWill(state: BattleState, cost: number): BattleRejection | null {
  if (state.turnWill < cost) return { rejected: 'INSUFFICIENT_WILL', cost, left: state.turnWill };
  state.turnWill -= cost;
  return null;
}
