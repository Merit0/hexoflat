import type { IInventoryDraft } from '../inventory/apply-stock';
import type { LootDrop } from './loot-table';
import { grantDrop, type SpreadDrop } from './plan-spread';

export interface AppliedSpread<R> {
  placed: R[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
}

export function applySpreadPlan<P extends SpreadDrop, R>(
  plan: {
    placements: readonly P[];
    toBag: readonly SpreadDrop[];
  },
  bag: IInventoryDraft,
  place: (placement: P) => R,
): AppliedSpread<R> {
  const placed = plan.placements.map(place);
  for (const drop of plan.toBag) grantDrop(bag, drop);
  return { placed, toBag: plan.toBag.map(({ itemKey, amount }) => ({ itemKey, amount })) };
}
