import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { BattleRejectionCode } from '@hexoflat/engine/battle/battle-rejection';

export interface BattleWarning {
  code: BattleRejectionCode;
  cost: number | null;
}

export function rejectionWarning(events: readonly DomainEvent[]): BattleWarning | null {
  const refused = events.find((event) => event.type === 'BATTLE_REJECTED');
  if (!refused) return null;
  const payload = refused.payload as { rejected: BattleRejectionCode; cost?: number };
  return { code: payload.rejected, cost: payload.cost ?? null };
}
