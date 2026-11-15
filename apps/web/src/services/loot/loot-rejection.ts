import type { DomainEvent } from '@hexoflat/engine/commands/types';

export const LOOT_REJECT_REASONS = [
  'NO_ROOM_FOR_LOOT',
  'BAG_FULL',
  'STANDING_ON_TARGET',
  'CHEST_EMPTY',
  'CONTAINER_EMPTY',
  'NOT_ADJACENT',
] as const;

export type LootRejectReason = (typeof LOOT_REJECT_REASONS)[number];

export const SHARED_CONTAINER_REFUSALS: readonly LootRejectReason[] = [
  'STANDING_ON_TARGET',
  'NO_ROOM_FOR_LOOT',
  'BAG_FULL',
];

export function isSharedContainerRefusal(code: string): code is LootRejectReason {
  return (SHARED_CONTAINER_REFUSALS as readonly string[]).includes(code);
}

export function lootRejectKey(reason: string): string {
  return `loot.reject.${reason}`;
}

export function lootRejectReasonOf(events: readonly DomainEvent[]): LootRejectReason | null {
  for (const event of events) {
    if (event.type !== 'LOOT_REJECTED') continue;
    const reason = (event.payload as { reason?: string }).reason;
    if ((LOOT_REJECT_REASONS as readonly string[]).includes(reason ?? '')) {
      return reason as LootRejectReason;
    }
  }
  return null;
}

export function lootLocaleKeys(): string[] {
  return LOOT_REJECT_REASONS.map(lootRejectKey);
}

export function lootRefusalText(
  events: readonly DomainEvent[],
  t: (key: string) => string,
): string | null {
  const reason = lootRejectReasonOf(events);
  return reason ? t(lootRejectKey(reason)) : null;
}
