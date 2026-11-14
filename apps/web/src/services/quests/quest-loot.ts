import type { DomainEvent } from '@hexoflat/engine/commands/types';
import type { IHexCoordinates } from '@hexoflat/engine/map/interfaces/hex-tile-config-interface';
import { LOOT_REJECT_REASONS, lootRejectKey } from '@/services/loot/loot-rejection';
import type { ChestOpened } from '@/services/loot/loot-flight';

interface ChestOpenedPayload {
  hex?: IHexCoordinates;
  placed?: { hex: IHexCoordinates; itemKey: string; amount: number }[];
  toBag?: { itemKey: string; amount: number }[];
}

export function questChestOpenedOf(events: readonly DomainEvent[]): ChestOpened | null {
  const event = events.find((candidate) => candidate.type === 'CHEST_OPENED');
  const payload = event?.payload as ChestOpenedPayload | undefined;
  if (!payload?.hex) return null;
  return {
    coordinates: { ...payload.hex },
    placed: (payload.placed ?? []).map((item) => ({
      coordinates: { ...item.hex },
      itemKey: item.itemKey,
      amount: item.amount,
    })),
    toBag: (payload.toBag ?? []).map((item) => ({ ...item })),
  };
}

export function questLootRefusalKey(reason: string): string | null {
  return (LOOT_REJECT_REASONS as readonly string[]).includes(reason)
    ? lootRejectKey(reason as (typeof LOOT_REJECT_REASONS)[number])
    : null;
}
