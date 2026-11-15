import { LOOT_REJECT_REASONS, lootRejectKey } from '@/services/loot/loot-rejection';

export function questLootRefusalKey(reason: string): string | null {
  return (LOOT_REJECT_REASONS as readonly string[]).includes(reason)
    ? lootRejectKey(reason as (typeof LOOT_REJECT_REASONS)[number])
    : null;
}
