import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type {
  BattleRejectionCode,
  CollectRejectionCode,
} from '@hexoflat/engine/battle/battle-rejection';

export type BattleWarningCode = BattleRejectionCode | CollectRejectionCode | 'FIGHT_NOT_OVER';

export interface BattleWarning {
  code: BattleWarningCode;
  cost: number | null;
}

export function rejectionWarning(events: readonly DomainEvent[]): BattleWarning | null {
  const refused = events.find((event) => event.type === 'BATTLE_REJECTED');
  if (!refused) return null;
  const payload = refused.payload as { rejected: BattleWarningCode; cost?: number };
  return { code: payload.rejected, cost: payload.cost ?? null };
}
