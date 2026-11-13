export type LootRefusalReason = 'NO_ROOM_FOR_LOOT';

export interface LootRefusal {
  ok: false;
  reason: LootRefusalReason;
}

export function lootRefusal(reason: LootRefusalReason): LootRefusal {
  return { ok: false, reason };
}
