import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import type { LootDrop } from './loot-table';

export interface AppliedSpread<R> {
  placed: R[];
  toBag: { itemKey: LootDrop['itemKey']; amount: number }[];
}

export function applySpreadPlan<P extends { itemKey: LootDrop['itemKey']; amount: number }, R>(
  plan: {
    placements: readonly P[];
    toBag: readonly { itemKey: LootDrop['itemKey']; amount: number }[];
  },
  bag: IInventoryDraft,
  place: (placement: P) => R,
): AppliedSpread<R> {
  const placed = plan.placements.map(place);
  for (const drop of plan.toBag) grantToDraft(bag, drop.itemKey, drop.amount, 'loot');
  return { placed, toBag: plan.toBag.map(({ itemKey, amount }) => ({ itemKey, amount })) };
}
