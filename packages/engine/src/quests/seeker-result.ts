import type { ProgressState } from '../aggregates/progress-state';
import type { DomainEvent } from '../commands/types';
import type { InventoryState } from '../inventory/inventory-state';
import type { QuestRun } from './quest-state';

export const SEEKER_REFUSALS = [
  'UNKNOWN_QUEST',
  'NOT_AT_BOARD',
  'NOT_ACTIVE',
  'QUEST_IN_PROGRESS',
  'INSUFFICIENT_WILL',
  'NOT_ADJACENT',
  'HEX_NOT_REVEALED',
  'HEX_BLOCKED',
  'USE_STEP_BACK',
  'NOTHING_TO_STEP_BACK',
  'WRONG_PHASE',
  'STANDING_ON_TARGET',
  'CONTAINER_EMPTY',
  'NO_ROOM_FOR_LOOT',
  'BAG_FULL',
  'OVERWEIGHT',
  'NO_LOOT_THERE',
  'NO_INVENTORY',
  'NO_ROOM_FOR_TRAIL',
] as const;
export type SeekerRefusal = (typeof SEEKER_REFUSALS)[number];

export type SeekerResult =
  | {
      ok: true;
      progress: ProgressState;
      run: QuestRun;
      events: DomainEvent[];
      inventory?: InventoryState;
    }
  | { ok: false; reason: SeekerRefusal; events: DomainEvent[] };

export function reject(
  progress: ProgressState,
  source: QuestRun | string,
  reason: SeekerRefusal,
  detail: Record<string, number> = {},
): SeekerResult {
  const questId = typeof source === 'string' ? source : source.offerId;
  const payload = { heroId: progress.knowledge.heroId, questId, reason, ...detail };
  return { ok: false, reason, events: [{ type: 'QUEST_REJECTED', payload }] };
}
