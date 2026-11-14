import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import type { THexobjectKey } from '../registry/hexobjects-registry';
import { bagTakesAll } from './plan-spread';

export type StackPickupRefusal = 'NO_LOOT_THERE' | 'NOT_ADJACENT' | 'BAG_FULL';

export interface StackPickupInput<S extends { itemKey: string; amount: number }> {
  stacks: readonly S[];
  isTarget: (stack: S) => boolean;
  adjacent: boolean;
  bag: IInventoryDraft;
}

export type StackPickupResult<S> =
  { ok: true; stack: S; remaining: S[] } | { ok: false; reason: StackPickupRefusal };

export function pickupStack<S extends { itemKey: string; amount: number }>(
  input: StackPickupInput<S>,
): StackPickupResult<S> {
  const stack = input.stacks.find(input.isTarget);
  if (!stack) return { ok: false, reason: 'NO_LOOT_THERE' };
  if (!input.adjacent) return { ok: false, reason: 'NOT_ADJACENT' };
  const drop = { itemKey: stack.itemKey as THexobjectKey, amount: stack.amount, guaranteed: false };
  if (!bagTakesAll(input.bag, [drop])) return { ok: false, reason: 'BAG_FULL' };
  grantToDraft(input.bag, drop.itemKey, drop.amount, 'pickup');
  return { ok: true, stack, remaining: input.stacks.filter((s) => !input.isTarget(s)) };
}
