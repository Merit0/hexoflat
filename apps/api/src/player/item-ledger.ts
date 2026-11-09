import type { DomainEvent } from '@hexoflat/engine';
import { heldAmount } from '@hexoflat/engine';
import { HEXOBJECT_KEYS } from '@hexoflat/engine/registry/hexobjects-registry';
import type { InventoryState } from '@hexoflat/engine/inventory/inventory-state';

export interface LedgerEntry {
  itemKey: string;
  delta: number;
  balanceAfter: number;
  reason: string;
}

interface Movement {
  itemKey: string;
  delta: number;
  reason: string;
}

function movementsOf(event: DomainEvent): Movement[] {
  if (event.type === 'INVENTORY_REPLACED') {
    const deltas = (event.payload as { deltas: { key: string; delta: number }[] }).deltas;
    return deltas.map(({ key, delta }) => ({ itemKey: key, delta, reason: 'dev_set' }));
  }
  const single = movementOf(event);
  return single ? [single] : [];
}

function movementOf(event: DomainEvent): Movement | null {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (!payload) return null;
  switch (event.type) {
    case 'ITEM_GRANTED':
      return {
        itemKey: String(payload.key),
        delta: Number(payload.amount),
        reason: String(payload.source),
      };
    case 'ITEM_CONSUMED':
      return { itemKey: String(payload.key), delta: -Number(payload.amount), reason: 'consume' };
    case 'STASH_CHEST_UNLOCKED':
      return {
        itemKey: HEXOBJECT_KEYS.COINS,
        delta: -Number(payload.price),
        reason: 'stash_unlock',
      };
    default:
      return null;
  }
}

export function ledgerEntriesFor(
  events: readonly DomainEvent[],
  before: InventoryState,
): LedgerEntry[] {
  const balances = new Map<string, number>();
  const entries: LedgerEntry[] = [];
  for (const event of events) {
    for (const movement of movementsOf(event)) {
      if (movement.delta === 0) continue;
      const start = balances.get(movement.itemKey) ?? heldAmount(before, movement.itemKey);
      const balanceAfter = start + movement.delta;
      balances.set(movement.itemKey, balanceAfter);
      entries.push({ ...movement, balanceAfter });
    }
  }
  return entries;
}
