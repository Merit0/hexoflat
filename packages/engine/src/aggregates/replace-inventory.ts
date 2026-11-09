import type { DomainEvent } from '../commands/types';
import { toAggregate } from '../inventory/inventory-adapter';
import type { InventoryState } from '../inventory/inventory-state';
import { countItem } from '../inventory/plan-stock';

function totals(state: InventoryState): Map<string, number> {
  const held = new Map<string, number>();
  const aggregate = toAggregate(state);
  for (const cell of [...aggregate.bag, ...Object.values(aggregate.equip), ...aggregate.stash]) {
    if (cell) held.set(cell.key, countItem(aggregate, cell.key));
  }
  return held;
}

export function replaceInventory(
  current: InventoryState,
  payload: { heroId: string; revision: number; inventory: InventoryState },
): { inventory: InventoryState | undefined; events: DomainEvent[] } {
  const { heroId, revision, inventory } = payload;
  if (current.heroId !== heroId) {
    return {
      inventory: current,
      events: [
        {
          type: 'ITEM_TRANSFER_REJECTED',
          payload: { heroId, command: 'DEV_SET_INVENTORY', reason: 'NO_INVENTORY' },
        },
      ],
    };
  }
  if (current.revision !== revision) {
    return {
      inventory: current,
      events: [
        {
          type: 'ITEM_TRANSFER_REJECTED',
          payload: { heroId, command: 'DEV_SET_INVENTORY', reason: 'INVENTORY_STALE' },
        },
      ],
    };
  }
  const before = totals(current);
  const next: InventoryState = { ...inventory, heroId, revision: current.revision + 1 };
  const after = totals(next);
  const deltas = [...new Set([...before.keys(), ...after.keys()])]
    .map((key) => ({ key, delta: (after.get(key) ?? 0) - (before.get(key) ?? 0) }))
    .filter((entry) => entry.delta !== 0);
  return {
    inventory: next,
    events: [
      { type: 'INVENTORY_REPLACED', payload: { heroId, deltas } },
      { type: 'INVENTORY_CHANGED', payload: { heroId, revision: next.revision } },
    ],
  };
}
