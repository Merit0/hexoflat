import type { BattleProjection } from '@hexoflat/engine/battle/projection';
import { inventorySession } from '@/services/inventory/inventory-session';
import { sendProgress } from '@/services/inventory/inventory-sync';

export function needsGraveExitWarning(view: BattleProjection | null): boolean {
  return !!view?.lootLeft && !inventorySession.graveExitWarningAcknowledged;
}

export async function acknowledgeGraveExitWarning(): Promise<boolean> {
  const answer = await sendProgress('ACK_GRAVE_EXIT_WARNING', {}, { withKnowledgeRevision: false });
  return answer.ok;
}
