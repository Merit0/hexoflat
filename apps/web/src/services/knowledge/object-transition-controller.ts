import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { EHexActionType } from '@hexoflat/engine/enums/hex-action-type';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import type { QuestRunAnswer } from '@/services/quests/quest-run-transport';

const pending = new Set<string>();

/** Hold the guard across presence synchronization and destination entry. */
export async function runObjectTransition<T>(
  key: string,
  execute: () => Promise<T>,
  ignored: () => T,
): Promise<T> {
  if (pending.has(key)) return ignored();
  pending.add(key);
  try {
    return await execute();
  } finally {
    pending.delete(key);
  }
}

interface QuestDestinationHost {
  isCurrent(): boolean;
  ensurePresence(): Promise<unknown>;
  send(): Promise<QuestRunAnswer>;
  refusalText(reason: string): string;
}

export async function enterQuestDestination(
  host: QuestDestinationHost,
  coordinates: IHexCoordinates,
  actionType: EHexActionType,
): Promise<DomainEvent[]> {
  if (!host.isCurrent()) return [];
  await host.ensurePresence();
  if (!host.isCurrent()) return [];
  const answer = await host.send();
  if (!host.isCurrent()) return [];
  if (answer.ok)
    return [
      ...answer.events,
      {
        type: 'HEX_ACTION_STARTED',
        payload: { coordinates, actionType, endsAt: Date.now() },
      },
    ];
  return [
    ...answer.events,
    {
      type: 'HEX_ACTION_START_REJECTED',
      payload: { coordinates, actionType, message: host.refusalText(answer.code) },
    },
  ];
}
