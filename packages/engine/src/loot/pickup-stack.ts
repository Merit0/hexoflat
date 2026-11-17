import { grantToDraft, type IInventoryDraft } from '../inventory/apply-stock';
import type { THexobjectKey } from '../registry/hexobjects-registry';

export type StackPickupRefusal = 'NO_LOOT_THERE' | 'NOT_ADJACENT' | 'BAG_FULL' | 'OVERWEIGHT';

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
  const trial: IInventoryDraft = { current: input.bag.current, events: [] };
  if (!grantToDraft(trial, stack.itemKey as THexobjectKey, stack.amount, 'pickup')) {
    const refused = trial.events.find((event) => event.type === 'ITEM_GRANT_REJECTED');
    const reason = (refused?.payload as { reason?: string } | undefined)?.reason;
    return { ok: false, reason: reason === 'TOO_HEAVY' ? 'OVERWEIGHT' : 'BAG_FULL' };
  }
  input.bag.current = trial.current;
  input.bag.events.push(...trial.events);
  return { ok: true, stack, remaining: input.stacks.filter((s) => !input.isTarget(s)) };
}
